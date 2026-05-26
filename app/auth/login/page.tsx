"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { signIn, type AuthState } from "../actions";

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(signIn, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-sm text-muted hover:text-fg">← Back</Link>
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-muted">Log in to your Stocksbrew account.</p>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input
            id="password" name="password" type="password" required autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 outline-none focus:border-accent"
          />
        </div>

        {state?.error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </div>
        )}

        <SubmitButton label="Log in" pendingLabel="Logging in…" />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New here? <Link href="/auth/signup" className="text-accent">Create an account</Link>
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
      className="w-full rounded-md bg-brand py-2 font-medium text-brand-fg disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
