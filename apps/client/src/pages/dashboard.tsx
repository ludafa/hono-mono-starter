import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

import { getApiNotes, postApiNotes } from '../gen/clients';
import type { Note } from '../gen/types';

export function DashboardPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    getApiNotes()
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const note = await postApiNotes({ title, body });
    setNotes((prev) => [...prev, note]);
    setTitle('');
    setBody('');
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="text-muted-foreground text-sm">
          A throwaway example wired through the full stack: Hono → OpenAPI →
          Kubb → React. Replace it with your domain.
        </p>
      </header>

      <form
        onSubmit={handleCreate}
        className="border-foreground/10 bg-card space-y-3 rounded-lg border p-4"
      >
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-foreground/15 focus:border-primary w-full border-0 border-b bg-transparent py-2 focus:ring-0 focus:outline-none"
        />
        <textarea
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="border-foreground/15 focus:border-primary w-full resize-none border-0 border-b bg-transparent py-2 focus:ring-0 focus:outline-none"
        />
        <Button type="submit" size="sm">
          Add note
        </Button>
      </form>

      {loading ?
        <p className="text-muted-foreground text-sm">Loading…</p>
      : notes.length === 0 ?
        <p className="text-muted-foreground text-sm">No notes yet.</p>
      : <ul className="divide-foreground/10 border-foreground/10 bg-card divide-y rounded-lg border">
          {notes.map((n) => (
            <li key={n.id} className="px-4 py-3">
              <div className="font-medium">{n.title}</div>
              {n.body && (
                <p className="text-muted-foreground mt-0.5 text-sm">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      }
    </div>
  );
}
