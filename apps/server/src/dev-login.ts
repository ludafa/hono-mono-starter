import { networkInterfaces } from 'node:os';

import { getConnInfo } from '@hono/node-server/conninfo';
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint, formCsrfMiddleware } from 'better-auth/api';
import { expireCookie, setSessionCookie } from 'better-auth/cookies';
import { createMiddleware } from 'hono/factory';

// See apps/docs/dev-auto-login/tech.md §3.

export const DEV_USER_EMAIL = 'test@test.com';

// See apps/docs/dev-auto-login/tech.md §2.
export const devAutoLoginRequested = process.env.DEV_AUTO_LOGIN === 'true';

export const devAutoLoginEnabled =
  devAutoLoginRequested && process.env.NODE_ENV === 'dev';

// See apps/docs/dev-auto-login/tech.md §3.2.
function isOwnAddress(address: string | undefined) {
  if (!address) {
    return false;
  }
  const ip = address.replace(/^::ffff:/, '').replace(/%.*$/, '');
  if (ip === '::1' || ip.startsWith('127.')) {
    return true;
  }
  return Object.values(networkInterfaces()).some((list) =>
    list?.some((iface) => iface.address === ip),
  );
}

// See apps/docs/dev-auto-login/tech.md §3.2.
export function devLoginLocalOnly() {
  const localHostnames = new Set([
    'localhost',
    '127.0.0.1',
    '[::1]',
    new URL(process.env.SERVER_URL ?? 'http://localhost:3000').hostname,
  ]);
  return createMiddleware(async (c, next) => {
    const { hostname } = new URL(c.req.url);
    if (
      !isOwnAddress(getConnInfo(c).remote.address) ||
      !localHostnames.has(hostname)
    ) {
      return c.json({ error: 'Dev sign-in is only available locally' }, 403);
    }
    await next();
  });
}

export const devLogin = () =>
  ({
    id: 'dev-login',
    endpoints: {
      // See apps/docs/dev-auto-login/tech.md §3.1 and §3.3.
      devSignIn: createAuthEndpoint.serverOnly(
        { method: 'POST', use: [formCsrfMiddleware] },
        async (ctx) => {
          const { internalAdapter } = ctx.context;
          const findUser = async () =>
            (await internalAdapter.findUserByEmail(DEV_USER_EMAIL))?.user;
          let user = await findUser();
          if (!user) {
            try {
              user = await internalAdapter.createUser({
                email: DEV_USER_EMAIL,
                name: 'Test User',
                emailVerified: true,
              });
            } catch (error) {
              // See apps/docs/dev-auto-login/tech.md §3.4.
              user = await findUser();
              if (!user) {
                throw error;
              }
            }
          }
          const session = await internalAdapter.createSession(user.id);
          // See apps/docs/dev-auto-login/tech.md §3.5.
          await setSessionCookie(ctx, { session, user }, false);
          expireCookie(ctx, ctx.context.authCookies.dontRememberToken);
          return ctx.json({ user });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
