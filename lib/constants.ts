export const APP_NAME = "stocकaar" as const;
export const APP_TAGLINE = "India's most intuitive stock intelligence platform." as const;

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    // Temporarily lifted to 15 for all users while Pro tier launch is pending.
    maxWatchlistItems: 15,
    maxAlerts: 15,
    features: [
      "Track up to 15 stocks",
      "15 active price alerts",
      "Market dashboard",
      "Email alerts",
    ],
  },
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro",
    priceMonthly: 299,
    razorpayPlanEnv: "RAZORPAY_PLAN_MONTHLY",
    maxWatchlistItems: Infinity,
    maxAlerts: Infinity,
    features: [
      "Unlimited stocks",
      "Unlimited alerts",
      "Real-time updates",
      "Priority email delivery",
      "Advanced market data",
    ],
  },
  pro_annual: {
    id: "pro_annual",
    name: "Pro (Annual)",
    priceMonthly: 250,
    priceAnnual: 2999,
    razorpayPlanEnv: "RAZORPAY_PLAN_ANNUAL",
    maxWatchlistItems: Infinity,
    maxAlerts: Infinity,
    features: [
      "Everything in Pro",
      "2 months free (₹2,999/yr)",
      "Locked-in pricing",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

// Indian market hours (IST)
export const MARKET_OPEN_MIN = 9 * 60 + 15; // 555
export const MARKET_CLOSE_MIN = 15 * 60 + 30; // 930

export function isMarketOpen(now: Date = new Date()): boolean {
  // Convert to IST (UTC+5:30)
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutes >= MARKET_OPEN_MIN && minutes <= MARKET_CLOSE_MIN;
}

export const INDICES = [
  { symbol: "NIFTY 50", key: "NSE_INDEX|Nifty 50" },
  { symbol: "SENSEX", key: "BSE_INDEX|SENSEX" },
  { symbol: "BANK NIFTY", key: "NSE_INDEX|Nifty Bank" },
] as const;
