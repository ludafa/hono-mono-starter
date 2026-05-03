import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { authClient } from '../lib/auth-client';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? 'Sign up failed');
      } else {
        await navigate({ to: '/' });
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border-foreground/15 focus:border-primary w-full border-0 border-b bg-transparent py-2 text-base focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-foreground/15 focus:border-primary w-full border-0 border-b bg-transparent py-2 text-base focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            Password — at least 8
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="border-foreground/15 focus:border-primary w-full border-0 border-b bg-transparent py-2 text-base focus:ring-0 focus:outline-none"
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={loading} className="h-10 w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="text-muted-foreground text-center text-xs">
        Already a member?{' '}
        <Link to="/login" className="text-foreground underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
