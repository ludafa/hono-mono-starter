import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background relative min-h-screen">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Hono Mono Starter
          </h1>
          <p className="text-muted-foreground text-sm">Sign in to continue.</p>
        </div>
        <div className="mt-10 space-y-6">{children}</div>
      </div>
    </div>
  );
}
