// Icons from Lucide (https://lucide.dev, ISC license).
function Icon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Icon>
  );
}

export function MicIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 19v3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <rect x="9" y="2" width="6" height="13" rx="3" />
    </Icon>
  );
}

export function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </Icon>
  );
}

export function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Icon>
  );
}

// Spins on its own. Give it a size, e.g. className="size-4".
export function LoaderIcon({ className = "" }: { className?: string }) {
  return (
    <Icon className={`animate-spin ${className}`}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Icon>
  );
}
