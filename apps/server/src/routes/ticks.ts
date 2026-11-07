import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';

import { type AuthEnv, requireAuth } from '../middleware/auth.js';
import { ErrorSchema } from '../schemas/api.js';

// See apps/docs/toolchain/tech.md §5.6.

const TICK_INTERVAL_MS = 500;

const TickSchema = z
  .object({
    type: z.literal('tick'),
    n: z.number().int(),
    total: z.number().int(),
    at: z.string(),
  })
  .openapi('Tick');

const TickDoneSchema = z
  .object({
    type: z.literal('done'),
    total: z.number().int(),
  })
  .openapi('TickDone');

const TickEventSchema = z
  .discriminatedUnion('type', [TickSchema, TickDoneSchema])
  .openapi('TickEvent');

type TickEvent = z.infer<typeof TickEventSchema>;

const TicksQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(50).default(10),
  after: z.coerce.number().int().min(1).optional(),
});

// See apps/docs/toolchain/tech.md §5.7.
const ticksApp = new OpenAPIHono<AuthEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const error = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return c.json({ error }, 400);
    }
  },
});

ticksApp.use('/api/ticks/*', requireAuth);

const streamTicks = createRoute({
  method: 'get',
  path: '/api/ticks',
  tags: ['Ticks'],
  summary: 'Stream ticks as server-sent events',
  request: { query: TicksQuerySchema },
  responses: {
    200: {
      content: { 'text/event-stream': { schema: TickEventSchema } },
      description: 'One event per tick, then a done event',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid query',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Unauthorized',
    },
  },
});

ticksApp.openapi(streamTicks, (c) => {
  const { count, after } = c.req.valid('query');
  return streamSSE(c, async (stream) => {
    for (let n = (after ?? 0) + 1; n <= count && !stream.aborted; n++) {
      const tick: TickEvent = {
        type: 'tick',
        n,
        total: count,
        at: new Date().toISOString(),
      };
      await stream.writeSSE({ id: String(n), data: JSON.stringify(tick) });
      if (n < count) {
        await stream.sleep(TICK_INTERVAL_MS);
      }
    }
    if (!stream.aborted) {
      const done: TickEvent = { type: 'done', total: count };
      await stream.writeSSE({ data: JSON.stringify(done) });
    }
  });
});

export { ticksApp };
