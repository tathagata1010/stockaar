import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-3xl font-bold">Check your email</h1>
      <p className="mt-4 text-muted">
        We sent you a confirmation link. Click it to verify your account, then log in.
      </p>
      <Link href="/auth/login" className="mt-8 text-accent">Back to login</Link>
    </main>
  );
}
