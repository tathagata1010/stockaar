// PDF text extraction for NSE filings.
//
// NSE attchmntText is just a 1-sentence regulatory blurb. The real content
// (concall transcripts, investor decks, business updates) lives in the PDF at
// `pdf_url`. This module downloads the PDF and runs pdf-parse to get the text.
// Image-based PDFs (scanned transcripts) return little/no text — those filings
// will be marked `skipped` and would need OCR (phase 3 follow-up).
//
// pdf-parse is lazy-imported because pdfjs-dist references browser globals
// (DOMMatrix, Path2D) at module load. Eager import would crash any server
// route that transitively imports this file (e.g. the /guidance read page).

const PDF_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/pdf,*/*",
  Referer: "https://www.nseindia.com/",
};

// Cap PDF download to ~10 MB; transcripts/decks rarely exceed this and bigger
// files are usually appendices we don't need.
const MAX_BYTES = 10 * 1024 * 1024;

export async function fetchPdfText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: PDF_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[pdf] ${res.status} ${url}`);
      return null;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      console.warn(`[pdf] too large ${buf.byteLength}B ${url}`);
      return null;
    }
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const out = await parser.getText();
      return (out.text || "").trim() || null;
    } finally {
      await parser.destroy().catch(() => {});
    }
  } catch (e) {
    console.warn("[pdf] error", url, e instanceof Error ? e.message : e);
    return null;
  }
}
