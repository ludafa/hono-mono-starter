import { serve } from '@hono/node-server';

import { app } from './app.js';
import { generateOpenAPISpec } from './generate-spec.js';

// Generate openapi.yml on dev server start
generateOpenAPISpec(app);

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
  console.log(`Swagger UI at http://localhost:${info.port}/reference`);
  console.log(`OpenAPI spec at http://localhost:${info.port}/doc`);
});
