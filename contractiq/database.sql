-- ============================================================================
-- ContractIQ — Production Database Schema
-- ============================================================================
-- Source: docs/engineering/engineering-doc.md (§7 Database Design, §8 AI
-- Architecture, §9 API Specification) and docs/specs/*.md (per-feature specs,
-- US-001 through US-012).
--
-- Target: Supabase PostgreSQL (relies on the built-in `auth.users` table and
-- `storage.objects` / `storage.buckets` tables provided by Supabase Auth and
-- Supabase Storage — this will not run against a bare PostgreSQL instance).
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--   Or: supabase db execute -f database.sql
--   Or: psql "$DATABASE_URL" -f database.sql
--
-- Idempotent: safe to re-run against a database that already has this schema
-- applied — tables use IF NOT EXISTS, policies are dropped and recreated, and
-- the storage bucket upsert refreshes its settings on conflict.
--
-- Note: there is no `users` table here — auth is handled entirely by
-- Supabase's built-in `auth.users` (docs/specs/01-auth.md: "None — uses
-- Supabase's built-in auth.users table. No migration required beyond
-- enabling the Email provider."). Every `user_id` column below references
-- `auth.users(id)` directly.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Shared trigger function: auto-update `updated_at` on row modification
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- Table: contracts
-- Owner of the review: one row per uploaded PDF. `contract_text` holds the
-- extracted text with `[PAGE N]` markers inserted at upload time (see
-- lib/services/pdf.ts); `status` drives the upload → process → results flow.
-- ============================================================================
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name varchar(255) not null,
  type varchar(10) not null check (type in ('nda', 'msa')),
  contract_text text,
  file_path varchar(500),
  status varchar(20) not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'processed', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contracts_user_id on contracts(user_id);
create index if not exists idx_contracts_status on contracts(status);
create index if not exists idx_contracts_created_at on contracts(created_at desc);

drop trigger if exists trg_contracts_updated_at on contracts;
create trigger trg_contracts_updated_at
  before update on contracts
  for each row execute function set_updated_at();

alter table contracts enable row level security;

drop policy if exists "Users can view own contracts" on contracts;
create policy "Users can view own contracts" on contracts
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create own contracts" on contracts;
create policy "Users can create own contracts" on contracts
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own contracts" on contracts;
create policy "Users can update own contracts" on contracts
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own contracts" on contracts;
create policy "Users can delete own contracts" on contracts
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- Table: key_terms
-- AI-extracted standard terms for a contract (US-002/003/004/009). One row
-- per successfully extracted standard term; a requested term the model
-- didn't find simply has no row (surfaced client-side as "Not found").
-- ============================================================================
create table if not exists key_terms (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade not null,
  term_name varchar(100) not null,
  value text,
  page_number int check (page_number > 0),
  confidence_score decimal(5,4) check (confidence_score between 0 and 1),
  source_sentence text,
  is_edited boolean not null default false,
  original_value text,
  created_at timestamptz not null default now()
);

create index if not exists idx_key_terms_contract_id on key_terms(contract_id);
create index if not exists idx_key_terms_confidence on key_terms(confidence_score);

alter table key_terms enable row level security;

drop policy if exists "Users can manage own key_terms" on key_terms;
create policy "Users can manage own key_terms" on key_terms
  for all using (
    exists (
      select 1 from contracts
      where contracts.id = key_terms.contract_id
      and contracts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Table: custom_key_terms
-- User-defined terms (US-005), up to 5 per contract (enforced at the app
-- layer in app/api/contracts/upload/route.ts, not via a DB constraint). Rows
-- are inserted as name-only placeholders at upload time and populated with
-- value/page/confidence/source during extraction (US-003 process route).
-- ============================================================================
create table if not exists custom_key_terms (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade not null,
  term_name varchar(100) not null,
  value text,
  page_number int check (page_number > 0),
  confidence_score decimal(5,4) check (confidence_score between 0 and 1),
  source_sentence text,
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_key_terms_contract_id on custom_key_terms(contract_id);

alter table custom_key_terms enable row level security;

drop policy if exists "Users can manage own custom_key_terms" on custom_key_terms;
create policy "Users can manage own custom_key_terms" on custom_key_terms
  for all using (
    exists (
      select 1 from contracts
      where contracts.id = custom_key_terms.contract_id
      and contracts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Table: chat_sessions
-- One chat session per contract (US-007/012). `unique` on contract_id
-- enforces the 1:1 relationship; lib/services/chat.ts's getOrCreateChatSession
-- relies on this to make session lookup idempotent.
-- ============================================================================
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_sessions_contract_id on chat_sessions(contract_id);

alter table chat_sessions enable row level security;

drop policy if exists "Users can access own chat_sessions" on chat_sessions;
create policy "Users can access own chat_sessions" on chat_sessions
  for all using (
    exists (
      select 1 from contracts
      where contracts.id = chat_sessions.contract_id
      and contracts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Table: chat_messages
-- Turn-by-turn chat history (US-007/012). `page_citation` is parsed from the
-- assistant's "[Page X]" citation via lib/services/chat.ts's
-- extractPageCitation and is null for user messages. `source` records which
-- context type (contract / history / both) the conversation memory layer
-- classified the question as, for UI attribution; null for user messages.
-- ============================================================================
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade not null,
  role varchar(10) not null check (role in ('user', 'assistant')),
  content text not null,
  page_citation int,
  source varchar(10) check (source in ('contract', 'history', 'both')),
  created_at timestamptz not null default now()
);

alter table chat_messages add column if not exists source varchar(10) check (source in ('contract', 'history', 'both'));

create index if not exists idx_chat_messages_session_id on chat_messages(session_id);
create index if not exists idx_chat_messages_created_at on chat_messages(created_at);

alter table chat_messages enable row level security;

drop policy if exists "Users can access own chat_messages" on chat_messages;
create policy "Users can access own chat_messages" on chat_messages
  for all using (
    exists (
      select 1 from chat_sessions
      join contracts on contracts.id = chat_sessions.contract_id
      where chat_sessions.id = chat_messages.session_id
      and contracts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Table: user_feedback
-- Thumbs up/down + optional comment (US-010), one row per (user, contract)
-- via the unique constraint — resubmission is an upsert, not a duplicate
-- (docs/specs/08-feedback.md AC-2).
-- ============================================================================
create table if not exists user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contract_id uuid references contracts(id) on delete cascade not null,
  rating varchar(10) not null check (rating in ('up', 'down')),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, contract_id)
);

create index if not exists idx_user_feedback_contract_id on user_feedback(contract_id);
create index if not exists idx_user_feedback_user_id on user_feedback(user_id);

alter table user_feedback enable row level security;

drop policy if exists "Users can manage own feedback" on user_feedback;
create policy "Users can manage own feedback" on user_feedback
  for all using (auth.uid() = user_id);

-- ============================================================================
-- Storage: `contracts` bucket
-- Path convention: {user_id}/{contract_id}/{filename}.pdf — the RLS policies
-- below key off the first path segment being the caller's own user id (see
-- lib/services/storage.ts). Private bucket; all access goes through signed
-- URLs (getSignedContractUrl, 1hr expiry) or these RLS-scoped policies.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own contracts" on storage.objects;
create policy "Users can upload own contracts" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read own contracts" on storage.objects;
create policy "Users can read own contracts" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own contracts" on storage.objects;
create policy "Users can delete own contracts" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- End of schema
-- ============================================================================
