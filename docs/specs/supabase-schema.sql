-- ============================================================================
-- ContractIQ — Supabase Schema
-- Paste this entire file into the Supabase SQL Editor and run on a fresh
-- project. Safe to run once on an empty database (tables/policies are
-- created fresh, no IF NOT EXISTS guards are needed on a clean project).
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
-- ============================================================================
create table contracts (
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

create index idx_contracts_user_id on contracts(user_id);
create index idx_contracts_status on contracts(status);
create index idx_contracts_created_at on contracts(created_at desc);

create trigger trg_contracts_updated_at
  before update on contracts
  for each row execute function set_updated_at();

alter table contracts enable row level security;

create policy "Users can view own contracts" on contracts
  for select using (auth.uid() = user_id);

create policy "Users can create own contracts" on contracts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own contracts" on contracts
  for update using (auth.uid() = user_id);

create policy "Users can delete own contracts" on contracts
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- Table: key_terms
-- ============================================================================
create table key_terms (
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

create index idx_key_terms_contract_id on key_terms(contract_id);
create index idx_key_terms_confidence on key_terms(confidence_score);

alter table key_terms enable row level security;

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
-- ============================================================================
create table custom_key_terms (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade not null,
  term_name varchar(100) not null,
  value text,
  page_number int check (page_number > 0),
  confidence_score decimal(5,4) check (confidence_score between 0 and 1),
  source_sentence text,
  created_at timestamptz not null default now()
);

create index idx_custom_key_terms_contract_id on custom_key_terms(contract_id);

alter table custom_key_terms enable row level security;

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
-- ============================================================================
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade not null unique,
  created_at timestamptz not null default now()
);

create index idx_chat_sessions_contract_id on chat_sessions(contract_id);

alter table chat_sessions enable row level security;

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
-- ============================================================================
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade not null,
  role varchar(10) not null check (role in ('user', 'assistant')),
  content text not null,
  page_citation int,
  source varchar(10) check (source in ('contract', 'history', 'both')),
  created_at timestamptz not null default now()
);

create index idx_chat_messages_session_id on chat_messages(session_id);
create index idx_chat_messages_created_at on chat_messages(created_at);

alter table chat_messages enable row level security;

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
-- ============================================================================
create table user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contract_id uuid references contracts(id) on delete cascade not null,
  rating varchar(10) not null check (rating in ('up', 'down')),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, contract_id)
);

create index idx_user_feedback_contract_id on user_feedback(contract_id);
create index idx_user_feedback_user_id on user_feedback(user_id);

alter table user_feedback enable row level security;

create policy "Users can manage own feedback" on user_feedback
  for all using (auth.uid() = user_id);

-- ============================================================================
-- Storage: `contracts` bucket
-- Path convention: contracts/{user_id}/{contract_id}/{filename}.pdf
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "Users can upload own contracts" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own contracts" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own contracts" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- End of schema
-- ============================================================================
