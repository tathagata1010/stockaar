import { Disclaimer } from "./Disclaimer";
import { RelatedSurfaces, type RelatedSurfacesProps } from "./RelatedSurfaces";

// Universal end-of-page block: compliance disclaimer + related-surfaces
// grid. Every authed page under app/(app) should render one of these so
// the app has a consistent tail — no page ends abruptly.

export type PageFooterProps = {
  kind: RelatedSurfacesProps["kind"];
  contextSymbol?: string | null;
  contextName?: string | null;
  sector?: string | null;
  disclaimerVariant?: "default" | "bold";
};

export function PageFooter({ kind, contextSymbol, contextName, sector, disclaimerVariant }: PageFooterProps) {
  return (
    <>
      <Disclaimer variant={disclaimerVariant} className="mt-10" />
      <RelatedSurfaces
        kind={kind}
        contextSymbol={contextSymbol}
        contextName={contextName}
        sector={sector}
      />
    </>
  );
}
