import { NextResponse } from "next/server";

// TEMP: paid plans paused while the app is free-for-all. The real handler is
// preserved in git history (see `lib/razorpay.ts` for the SDK wrapper).
// Re-enable by restoring the prior implementation that called
// `razorpay().subscriptions.create(...)` and updated the user's profile.
export async function POST() {
  return NextResponse.json(
    { error: "Paid plans are paused \u2014 everything is free right now." },
    { status: 503 },
  );
}
