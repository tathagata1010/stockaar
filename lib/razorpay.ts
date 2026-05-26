import crypto from "node:crypto";
import Razorpay from "razorpay";

export type PlanKey = "pro_monthly" | "pro_annual";

let _client: Razorpay | null = null;
export function razorpay(): Razorpay {
  if (_client) return _client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay env missing");
  _client = new Razorpay({ key_id, key_secret });
  return _client;
}

export function isRazorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function planIdFor(key: PlanKey): string | undefined {
  return key === "pro_monthly"
    ? process.env.RAZORPAY_PLAN_MONTHLY
    : process.env.RAZORPAY_PLAN_ANNUAL;
}

// Verify Razorpay webhook signature (X-Razorpay-Signature)
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// Map Razorpay subscription status → our profiles.plan + subscription_status
export function statusToPlan(status: string, planKey: PlanKey): {
  plan: "free" | PlanKey;
  status: string;
} {
  const active = ["active", "authenticated", "pending", "halted"].includes(status);
  return { plan: active ? planKey : "free", status };
}
