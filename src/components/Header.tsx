import { ModeToggle } from './ModeToggle';

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b pb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <a href="/" className="no-underline text-foreground hover:text-foreground/80 transition-colors">
            /uses
          </a>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A list of <code className="bg-muted px-1 py-0.5 rounded text-xs">/uses</code> pages detailing developer setups, gear, software and configs.
        </p>
      </div>
      <ModeToggle />
    </header>
  );
}
