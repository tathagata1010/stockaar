import { notFound } from "next/navigation";
import { decodeReadUrl } from "@/lib/news/href";
import { ReaderView, InvalidTargetView, isInvalidTarget } from "@/components/reader/ReaderView";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Reader — Stocksbrew India",
};

export default async function ReadPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  if (!u) notFound();
  const decoded = decodeReadUrl(u);
  if (!decoded) notFound();
  if (isInvalidTarget(decoded)) return <InvalidTargetView />;
  return <ReaderView target={decoded} />;
}
