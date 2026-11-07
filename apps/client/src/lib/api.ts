import { apiErrorSchema, client, ResponseError } from '@/gen';

client.setConfig({
  baseURL: '',
  credentials: 'include',
});

// See apps/docs/toolchain/tech.md §5.7.
export async function errorMessage(err: unknown): Promise<string> {
  if (!ResponseError.is(err)) {
    return String(err);
  }
  const data =
    err.data instanceof ReadableStream
      ? await new Response(err.data).json().catch(() => undefined)
      : err.data;
  const parsed = apiErrorSchema.safeParse(data);
  return parsed.success ? parsed.data.error : `HTTP ${err.status}`;
}
