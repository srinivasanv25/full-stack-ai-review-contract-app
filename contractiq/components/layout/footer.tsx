export function Footer() {
  return (
    <footer className="border-t border-border bg-background-subtle">
      <div className="mx-auto flex max-w-6xl flex-col gap-sm px-md py-lg text-center text-small text-text-muted sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>&copy; {new Date().getFullYear()} ContractIQ. All rights reserved.</p>
        <p>
          ContractIQ does not provide legal advice.{' '}
          <a
            href="mailto:support@contractiq.app"
            className="font-medium text-text-secondary hover:text-primary"
          >
            Contact support
          </a>
        </p>
      </div>
    </footer>
  )
}
