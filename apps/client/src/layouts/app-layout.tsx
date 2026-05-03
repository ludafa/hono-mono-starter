import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

import { authClient } from '../lib/auth-client';

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    await navigate({ to: '/login' });
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="border-foreground/10 bg-background/85 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Hono Mono Starter
          </Link>
          <div className="flex items-center gap-3">
            {session?.user && (
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {session.user.email}
              </span>
            )}
            <ThemeToggle />
            {session?.user && (
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
