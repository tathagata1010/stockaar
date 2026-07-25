import { z } from "zod";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { streamAgent } from "@/lib/agent/stream";
import { clientIp } from "@/lib/doctor/rate-limit";
import { enforceChat } from "@/lib/ratelimit/check";
import {
  bucketFor,
  cacheKey,
  createRecorder,
  isCacheable,
  readCache,
  replayFromCache,
} from "@/lib/ai/response-cache";
import type { PlanId } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  contextSymbol: z.string().trim().toUpperCase().max(20).optional(),
  articleContext: z
    .object({
      title: z.string().trim().min(1).max(400),
      url: z.string().url().max(2000),
      publisher: z.string().trim().max(120).optional(),
      publishedAt: z.number().int().optional(),
      body: z.string().trim().min(50).max(8000),
    })
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(24)
    .optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // DEV BYPASS — revert before commit/push (memory rule).
  const isDev = process.env.NODE_ENV !== "production";
  if (!user && !isDev) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  let planTier: "free" | "pro" = "free";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", user.id)
      .single();
    const plan = (profile?.plan ?? "free") as PlanId;
    planTier = plan === "free" ? "free" : "pro";
  } else {
    planTier = "pro"; // dev bypass — grant pro locally
  }

  // Response cache — same question in the same freshness bucket replays
  // instantly and skips the rate-limit budget. Skips personalized turns
  // (article body, portfolio, etc.).
  const cacheableInput = {
    message: parsed.data.message,
    symbol: parsed.data.contextSymbol,
    articleUrl: parsed.data.articleContext?.url,
    articleBody: parsed.data.articleContext?.body,
  };
  const bucket = bucketFor(parsed.data.message);
  const cacheable = isCacheable(cacheableInput);
  const key = cacheable ? cacheKey(cacheableInput, bucket) : null;
  const hit = key ? await readCache(key) : null;

  if (hit) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        try {
          await replayFromCache(hit, emit);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Cache": "HIT",
      },
    });
  }

  // Sliding-window rate limits per tier. Free/pro both go through the same
  // limiter (different budgets) so a compromised pro account can't burn our
  // whole Groq budget. Fails open on Redis blips.
  const decision = await enforceChat({
    userId: user?.id ?? null,
    ip: clientIp(request),
    tier: planTier,
  });
  const rlHeaders = {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(decision.resetSec),
    "X-RateLimit-Scope": decision.scope,
  };
  if (!decision.ok) {
    const msg =
      decision.scope === "burst"
        ? `Too many asks in a short window. Try again in ${decision.resetSec}s.`
        : planTier === "free"
          ? `Hourly limit reached on the free plan — upgrade to Pro for more. Resets in ${decision.resetSec}s.`
          : `Hourly limit reached. Resets in ${decision.resetSec}s.`;
    return NextResponse.json(
      { error: msg, remaining: decision.remaining, resetSec: decision.resetSec, scope: decision.scope },
      { status: 429, headers: rlHeaders },
    );
  }

  const recorder = key
    ? createRecorder({ key, bucket, symbol: parsed.data.contextSymbol })
    : undefined;

  const stream = streamAgent({
    message: parsed.data.message,
    history: parsed.data.history,
    contextSymbol: parsed.data.contextSymbol,
    articleContext: parsed.data.articleContext,
    planTier,
    userId: user?.id ?? null,
    recorder,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Cache": "MISS",
      ...rlHeaders,
    },
  });
}
