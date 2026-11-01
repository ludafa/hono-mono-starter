import type { BetterAuthClientPlugin } from 'better-auth/client';
import { createAuthClient } from 'better-auth/react';

// See apps/docs/dev-auto-login/tech.md §4.2.
const devLoginClient = {
  id: 'dev-login',
  getActions: ($fetch, $store) => ({
    devSignIn: async () => {
      const result = await $fetch('/dev/sign-in', { method: 'POST' });
      if (!result.error) {
        $store.notify('$sessionSignal');
      }
      return result;
    },
  }),
} satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || undefined,
  // See apps/docs/dev-auto-login/tech.md §4.4.
  plugins: import.meta.env.VITE_DEV_AUTO_LOGIN ? [devLoginClient] : [],
});
