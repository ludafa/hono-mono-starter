import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { AppLayout } from '../layouts/app-layout';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/_app')({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      return;
    }
    // See apps/docs/dev-auto-login/tech.md §4.3.
    if (import.meta.env.VITE_DEV_AUTO_LOGIN && !session.error) {
      try {
        const { error } = await authClient.devSignIn();
        if (!error) {
          return;
        }
        console.warn(
          `DEV_AUTO_LOGIN: dev sign-in failed (HTTP ${error.status}); see the server log`,
        );
      } catch (error) {
        console.warn('DEV_AUTO_LOGIN: dev sign-in request failed', error);
      }
    }
    throw redirect({ to: '/login' });
  },
});
