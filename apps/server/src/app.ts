import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';

import { authApp } from './routes/auth.js';
import { exampleApp } from './routes/example.js';

const app = new OpenAPIHono();

// CORS for client dev server.
// Replace this list when you deploy or add other client origins.
app.use(
  '/api/*',
  cors({
    origin: (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173').split(','),
    credentials: true,
  }),
);

// Mount routes
app.route('/', authApp);
app.route('/', exampleApp);

// OpenAPI spec + Swagger UI
app.doc31('/doc', {
  openapi: '3.1.0',
  info: { title: 'Hono Mono Starter API', version: '1.0.0' },
});
app.get('/reference', swaggerUI({ url: '/doc' }));

export { app };
