import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getApiTicks, type Tick, tickEventSchema } from '@/gen';
import { errorMessage } from '@/lib/api';

// See apps/docs/toolchain/tech.md §5.6.

const COUNT = 10;
const CONNECT_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 3000;
const CONNECT_TIMEOUT = Symbol('connect-timeout');
const IDLE_TIMEOUT = Symbol('idle-timeout');

type Status = 'idle' | 'streaming' | 'done' | 'stopped' | 'dropped' | 'error';

const badgeVariant = {
  idle: 'outline',
  streaming: 'default',
  done: 'secondary',
  stopped: 'outline',
  dropped: 'destructive',
  error: 'destructive',
} as const;

export function TickStream() {
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>();
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function run(count: number, after?: number) {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('streaming');
    setError(undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (reason: symbol, ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(reason), ms);
    };
    try {
      arm(CONNECT_TIMEOUT, CONNECT_TIMEOUT_MS);
      const { stream } = await getApiTicks({
        query: { count, after },
        signal: controller.signal,
      });
      arm(IDLE_TIMEOUT, IDLE_TIMEOUT_MS);
      for await (const event of stream) {
        arm(IDLE_TIMEOUT, IDLE_TIMEOUT_MS);
        const parsed = tickEventSchema.safeParse(event.data);
        if (!parsed.success) {
          continue;
        }
        if (parsed.data.type === 'done') {
          setStatus('done');
          return;
        }
        const tick = parsed.data;
        setTicks((prev) => [...prev, tick]);
      }
      setStatus('dropped');
      setError('Stream ended without a done event.');
    } catch (err) {
      const { reason } = controller.signal;
      if (reason === CONNECT_TIMEOUT) {
        setStatus('dropped');
        setError(`No response in ${CONNECT_TIMEOUT_MS / 1000}s.`);
        return;
      }
      if (reason === IDLE_TIMEOUT) {
        setStatus('dropped');
        setError(`No event for ${IDLE_TIMEOUT_MS / 1000}s.`);
        return;
      }
      if (controller.signal.aborted) {
        setStatus('stopped');
        return;
      }
      const message = await errorMessage(err);
      setStatus('error');
      setError(message);
    } finally {
      clearTimeout(timer);
    }
  }

  function start() {
    setTicks([]);
    void run(COUNT);
  }

  const last = ticks.at(-1);
  const received = last?.n ?? 0;
  const total = last?.total;
  const canResume =
    (status === 'stopped' || status === 'dropped' || status === 'error') &&
    total !== undefined &&
    received < total;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-card/70 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="text-[0.7rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Live stream
        </p>
        <Badge variant={badgeVariant[status]}>{status}</Badge>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Server-sent events from <code className="text-xs">GET /api/ticks</code>,
        read with <code className="text-xs">for await</code>.
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-foreground/8">
        <div
          className="h-full bg-foreground transition-[width] duration-300"
          style={{ width: total ? `${(received / total) * 100}%` : '0%' }}
        />
      </div>
      {ticks.length > 0 && (
        <ol className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
          {ticks.map((t) => (
            <li key={t.n} className="flex justify-between">
              <span>
                #{t.n} / {t.total}
              </span>
              <span className="text-muted-foreground">
                {new Date(t.at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {canResume && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void run(total, received)}
          >
            Resume from #{received + 1}
          </Button>
        )}
        {status === 'streaming' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => controllerRef.current?.abort()}
          >
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={start}>
            {status === 'idle' ? 'Start' : 'Restart'}
          </Button>
        )}
      </div>
    </section>
  );
}
