import Link from 'next/link'
import { Zap, FileWarning, DollarSign, MapPinOff, Upload, Sparkles, MessageSquare } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { buttonClassNames } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const PROBLEM_POINTS = [
  {
    icon: FileWarning,
    title: 'Missed obligations',
    description:
      'Auto-renewal clauses, IP assignment, and non-competes buried on page 12 get signed without a second look.',
  },
  {
    icon: DollarSign,
    title: 'High legal cost',
    description:
      'Ad-hoc legal consultations run $250–$500/hr for reviews that should take fifteen minutes.',
  },
  {
    icon: MapPinOff,
    title: 'No page attribution',
    description:
      'Generic AI summarizers give you a paragraph with no way to verify where a claim actually came from.',
  },
]

const HOW_IT_WORKS = [
  {
    icon: Upload,
    title: 'Upload',
    description: 'Drop in your NDA or MSA as a PDF. We extract the text and page structure automatically.',
  },
  {
    icon: Sparkles,
    title: 'AI Extraction',
    description:
      'GPT-4o pulls out key terms with a confidence score and the exact page and sentence they came from.',
  },
  {
    icon: MessageSquare,
    title: 'Review & Chat',
    description: 'Verify terms against the source PDF, edit anything that’s wrong, and ask follow-up questions.',
  },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header variant="marketing" />

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-md py-3xl text-center">
          <span className="mb-lg inline-flex items-center gap-xs rounded-full bg-accent-light px-md py-xs text-small font-semibold text-primary">
            <Zap size={14} strokeWidth={2} aria-hidden />
            NDA &amp; MSA review in under 15 minutes
          </span>

          <h1 className="text-display text-text-primary">
            Understand any contract
            <br />
            <span className="text-primary">before you sign.</span>
          </h1>

          <p className="mt-lg max-w-xl text-body-lg text-text-secondary">
            ContractIQ extracts the key terms from your NDA or MSA, shows exactly where each
            clause lives in the document, scores how confident the AI is — and lets you ask
            questions in plain English.
          </p>

          <div className="mt-xl flex flex-col gap-sm sm:flex-row">
            <Link href="/signup" className={buttonClassNames('primary', 'md')}>
              Start reviewing for free
            </Link>
            <a href="#how-it-works" className={buttonClassNames('ghost', 'md')}>
              See how it works
            </a>
          </div>

          <p className="mt-md text-small text-text-muted">14-day free trial &middot; No credit card required</p>
        </section>

        <section className="border-y border-border bg-background-subtle py-2xl">
          <div className="mx-auto max-w-6xl px-md">
            <p className="text-center text-small font-medium uppercase tracking-wide text-text-muted">
              Trusted by founders, ops managers, and freelancers reviewing NDAs and MSAs
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-md py-3xl">
          <h2 className="text-center text-h1 text-text-primary">Everything you need to review a contract</h2>
          <p className="mt-sm text-center text-body-lg text-text-secondary">
            Stop spending 90 minutes on a contract that should take 15.
          </p>

          <div className="mt-2xl grid gap-lg sm:grid-cols-3">
            {PROBLEM_POINTS.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="flex flex-col gap-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-input bg-accent-light text-primary">
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="text-h4 text-text-primary">{title}</h3>
                <p className="text-body text-text-secondary">{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-md py-3xl">
          <Card className="overflow-hidden p-0">
            <div className="flex aspect-[16/9] w-full items-center justify-center bg-background-subtle">
              <div className="flex flex-col items-center gap-sm text-text-muted">
                <Sparkles size={32} strokeWidth={1.5} aria-hidden />
                <p className="text-body font-medium">Results page preview</p>
                <p className="max-w-sm text-center text-small">
                  PDF viewer + key terms panel with page-level citations and confidence scores.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-md py-3xl">
          <h2 className="text-center text-h1 text-text-primary">How it works</h2>

          <div className="mt-2xl grid gap-lg sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ icon: Icon, title, description }, index) => (
              <div key={title} className="flex flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                  <Icon size={22} strokeWidth={1.75} aria-hidden />
                </span>
                <p className="mt-md text-small font-semibold text-text-muted">Step {index + 1}</p>
                <h3 className="text-h4 text-text-primary">{title}</h3>
                <p className="mt-xs text-body text-text-secondary">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-background-subtle py-lg">
          <p className="mx-auto max-w-3xl px-md text-center text-small text-text-muted">
            ContractIQ does not provide legal advice. Extracted terms are AI-generated and should
            be verified against the source document before making any decisions.
          </p>
        </section>

        <section className="mx-auto flex max-w-3xl flex-col items-center px-md py-3xl text-center">
          <h2 className="text-h1 text-text-primary">Ready to stop reading contracts line by line?</h2>
          <Link href="/signup" className={`${buttonClassNames('primary', 'md')} mt-lg`}>
            Get Started Free
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  )
}
