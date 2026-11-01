import { Hono } from 'hono';

import { auth } from '../auth.js';
import { devAutoLoginEnabled, devLoginLocalOnly } from '../dev-login.js';

const authApp = new Hono();

if (devAutoLoginEnabled) {
  // See apps/docs/dev-auto-login/tech.md §3.1.
  authApp.post('/api/auth/dev/sign-in', devLoginLocalOnly(), (c) =>
    auth.api.devSignIn({ request: c.req.raw, asResponse: true }),
  );
}

authApp.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

export { authApp };
