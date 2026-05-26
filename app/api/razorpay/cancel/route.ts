import { NextResponse } from "next/server";

// TEMP: paid plans paused while the app is free-for-all. The real handler is
// preserved in git history \u2014 it called `razorpay().subscriptions.cancel(...)`
// and flipped `subscription_status` to "cancelled" in the profiles table.
export async function POST() {
  return NextResponse.json(
    { error: "Paid plans are paused \u2014 nothing to cancel right now." },
    { status: 503 },
  );
}
