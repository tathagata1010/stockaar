import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTHED_PREFIXES = [
  "/dashboard",
  "/watchlist",
  "/alerts",
  "/account",
  "/screener",
  "/hot-stocks",
  "/anomalies",
  "/calendar",
  "/calls",
  "/trending",
  "/guidance",
  "/news",
  "/stock",
  "/indices",
  "/sectors",
  "/tools",
];

// API routes that read/write Supabase server-side: still need fresh auth
// cookies even though they aren't user-facing pages.
const AUTH_REFRESH_PREFIXES = [
  "/api/watchlist",
  "/api/alerts",
  "/api/account",
  "/api/razorpay",
  "/api/me",
  "/auth",
];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });

  const isAuthed = matches(pathname, AUTHED_PREFIXES);
  // Skip Supabase entirely on read-only API routes, marketing, static assets.
  // Cuts ~3s off most requests in dev because supabase.auth.getUser() makes
  // a network call we don't need for these paths.
  if (!isAuthed && !matches(pathname, AUTH_REFRESH_PREFIXES)) {
    return response;
  }

  let mutableResponse = response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          mutableResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            mutableResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code !== "refresh_token_already_used") {
      console.warn("[supabase/middleware] getUser failed", e);
    }
  }

  if (isAuthed && !user) {
    if (process.env.NODE_ENV === "development") return mutableResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return mutableResponse;
}
