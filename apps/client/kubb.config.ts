import { pluginFetch } from '@kubb/plugin-fetch';
import { pluginTs } from '@kubb/plugin-ts';
import { pluginZod } from '@kubb/plugin-zod';
import { defineConfig } from 'kubb/config';

// See apps/docs/toolchain/tech.md §5.
export default defineConfig({
  input: '../server/openapi.yml',
  output: {
    path: './src/gen',
    clean: true,
    barrel: { type: 'named' },
    // See apps/docs/lint-format/tech.md §5.
    format: 'oxfmt',
  },
  plugins: [pluginTs(), pluginFetch({ returnType: 'data' }), pluginZod()],
});
