export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockaar.vercel.app";
}
