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

export function XIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function CircleAlertIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </Icon>
  );
}

export function LogOutIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Icon>
  );
}

export function SquarePenIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
    </Icon>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </Icon>
  );
}

export function PanelLeftOpenIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </Icon>
  );
}

export function PanelLeftCloseIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </Icon>
  );
}

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
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
