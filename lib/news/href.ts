function toBase64Url(input: string): string {
  const b64 =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(input)))
      : Buffer.from(input, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return typeof atob === "function"
    ? decodeURIComponent(escape(atob(b64)))
    : Buffer.from(b64, "base64").toString("utf8");
}

export function base64UrlToBuffer(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function encodeReadUrl(url: string): string {
  return toBase64Url(url);
}

export function decodeReadUrl(encoded: string): string | null {
  try {
    const s = fromBase64Url(encoded);
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function readerHref(url: string): string {
  return `/read?u=${encodeReadUrl(url)}`;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90)
    .replace(/-+$/, "");
}

export function prettyReaderHref(publisherDomain: string, title: string): string {
  const domain = publisherDomain.toLowerCase().replace(/^www\./, "");
  const slug = slugifyTitle(title);
  if (!domain || !slug) return "";
  return `/read/${encodeURIComponent(domain)}/${slug}`;
}

const WRAPPER_HOSTS = new Set([
  "news.google.com",
  "www.google.com",
  "google.com",
  "l.facebook.com",
  "lm.facebook.com",
  "t.co",
  "l.instagram.com",
]);

export function canReaderExtract(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (WRAPPER_HOSTS.has(host)) return false;
    if (host === "www.bing.com" && u.pathname.includes("/apiclick.aspx")) return false;
    return true;
  } catch {
    return false;
  }
}

export function smartReaderHref(
  url: string,
  hint?: { publisherDomain?: string | null; title?: string | null },
): { href: string; internal: boolean } {
  if (hint?.publisherDomain && hint?.title) {
    const pretty = prettyReaderHref(hint.publisherDomain, hint.title);
    if (pretty) return { href: pretty, internal: true };
  }
  return { href: readerHref(url), internal: true };
}

export function externalLinkProps(_link: { internal: boolean }) {
  void _link;
  return {} as const;
}
