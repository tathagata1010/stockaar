"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUp, signInWithGoogle, type AuthState } from "../actions";

export default function SignupPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(signUp, null);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-sm text-muted hover:text-fg">← Back</Link>
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-muted">Track 3 stocks free. No card required.</p>

      <form action={signInWithGoogle} className="mt-8">
        <button
          type="submit"
          suppressHydrationWarning
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-2.5 text-sm font-medium hover:border-accent"
        >
          <GoogleMark />
          Continue with Google
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-border" /> or email <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            suppressHydrationWarning
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input
            id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
            suppressHydrationWarning
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>

        {state?.error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </div>
        )}

        <SubmitButton label="Create account" pendingLabel="Creating…" />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/auth/login" className="text-accent">Log in</Link>
      </p>
    </main>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      suppressHydrationWarning
      className="w-full rounded-md bg-brand py-2 font-medium text-brand-fg disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"/>
      <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"/>
      <path fill="#FBBC05" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"/>
    </svg>
  );
}
