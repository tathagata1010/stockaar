# Conventions

## TypeScript
- `strict: true`. No `any` unless interfacing with untyped library.
- Path alias `@/*` for project root.
- Prefer `type` over `interface` unless extending.

## React / Next.js
- **Server Components by default.** Mark `"use client"` only for: forms, hooks (`useState`, `useEffect`), event handlers, browser APIs.
- Server Actions over API routes for form mutations from same-origin UI.
- API routes (`app/api/*/route.ts`) for: webhooks, cron, third-party callbacks, non-form mutations.
- One default export per page/route file.
- Co-locate small components; promote to `components/` when reused.

## Supabase
- `lib/supabase/server.ts` for server components / route handlers.
- `lib/supabase/client.ts` for client components.
- **Never** use service role key in user-facing routes. Only in: `/api/cron/*`, `/api/razorpay/webhook`, admin scripts.
- Trust RLS — don't add redundant `where user_id = ...` clauses; let RLS enforce.
- Always handle the `error` from Supabase calls.

## Database
- Snake_case column names.
- Every user-owned table has `user_id uuid not null references auth.users(id) on delete cascade`.
- Every table has `created_at timestamptz not null default now()`.
- Enable RLS on every table before writing policies.
- Use `gen_random_uuid()` for PKs.

## API Routes
- Return `Response.json({ data })` on success.
- Return `Response.json({ error: "..." }, { status })` on failure. Status code carries semantics.
- Validate input with `zod`.
- Auth check at top of handler — return 401 if no session.
- Plan gating: read `profile.plan`, compare against `PLANS[plan].maxX`.

## Stock Data
- Always call `getQuote()` / `getQuotes()` from `lib/upstox.ts`. Never `fetch` Upstox directly.
- Quote cache TTL = 60s. Don't change without reason.
- On Upstox 401 → log, return null, UI shows "data unavailable".
- Symbols are uppercase (`RELIANCE`, not `reliance`).

## Formatting / i18n
- Currency: `formatINR(amount)` from `lib/utils.ts`. Never raw `₹${n}`.
- Percent: `formatPct(n)` — handles sign + 2 decimal places.
- Times in UI: IST. Store UTC in DB.
- Use `Intl.DateTimeFormat("en-IN")` for dates.

## Styling
- Tailwind utility classes. Custom CSS only in `app/globals.css` for resets.
- Dark theme only for MVP (matches stocksbrew aesthetic).
- Use `cn()` from `lib/utils.ts` to merge classes.
- Color palette in `tailwind.config.ts`: `bg`, `fg`, `muted`, `accent` (green), `danger` (red), `card`, `border`.

## Naming
- Components: `PascalCase.tsx`
- Utilities/lib: `camelCase.ts`
- Routes: `kebab-case/` directories
- Constants: `UPPER_SNAKE_CASE`
- Database tables: `snake_case` plural

## Comments
- Default: none. Code should be self-explanatory.
- WHY-comments only: workarounds, non-obvious constraints, SEBI/legal notes.
- Mark TODOs with the week: `// TODO Week 4: ...`

## Error handling
- Don't `try/catch` to swallow — only catch what you can recover from.
- User-facing errors: human messages, never raw stack traces.
- Server errors: log structured (`console.error({ ctx, err })`), Sentry catches in prod.

## Security
- Never log: passwords, full API keys, full tokens.
- Never put secrets in client-side env vars (only `NEXT_PUBLIC_*` is exposed; double-check what goes there).
- Razorpay webhook: verify signature BEFORE reading body.
- Cron endpoints: check `Authorization: Bearer ${CRON_SECRET}`.

## Disclaimers
- Every page showing stock data renders the footer disclaimer.
- Never use phrases: "buy", "sell", "should invest", "recommend", "guaranteed", "tip", "advice".
- Safe phrases: "watching", "trending", "tracked", "movement", "alert".

## Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Small commits, descriptive messages. No "wip" or "stuff".
