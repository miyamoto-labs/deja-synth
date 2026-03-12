export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ep-bg">
      <header className="border-b border-ep-border/50 bg-ep-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <span className="text-xs font-bold text-accent">D</span>
          </div>
          <span className="font-display font-bold text-sm text-text-primary">Déjà Admin</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-text-muted font-mono">internal</span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
