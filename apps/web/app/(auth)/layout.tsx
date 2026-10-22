// Shared by /login and /signup, so the background keeps drifting when switching between them.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div aria-hidden className="glow-bg" />
      {children}
    </div>
  );
}
