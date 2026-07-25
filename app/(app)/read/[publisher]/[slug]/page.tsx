import { notFound } from "next/navigation";
import { getStoredArticleBySlug } from "@/lib/news/stored";
import { ReaderView, InvalidTargetView, isInvalidTarget } from "@/components/reader/ReaderView";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Reader — Stocksbrew India",
};

export default async function ReadPrettyPage({
  params,
}: {
  params: Promise<{ publisher: string; slug: string }>;
}) {
  const { publisher, slug } = await params;
  const domain = decodeURIComponent(publisher);
  const stored = await getStoredArticleBySlug(domain, slug).catch(() => null);
  if (!stored) notFound();
  if (isInvalidTarget(stored.url)) return <InvalidTargetView />;
  return <ReaderView target={stored.url} stored={stored} />;
}
