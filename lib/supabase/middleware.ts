import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // When two requests arrive close together (e.g. page + a prefetch) both can
  // try to consume the same refresh token. Supabase then throws
  // `refresh_token_already_used` on the loser — harmless, the winner already
  // set fresh cookies. Swallow that one code; log anything else.
  try {
    await supabase.auth.getUser();
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code !== "refresh_token_already_used") {
      console.warn("[supabase/middleware] getUser failed", e);
    }
  }
  return response;
}
