// Static hex values mirroring the CSS tokens in app/globals.css (dark mode).
// Recharts needs concrete color strings, not Tailwind classes or CSS vars
// (we render on the server before hydration). Light-mode handling lives in
// each chart component if/when needed.

export const CHART_COLORS = {
  brand: "#6398ff",
  brand2: "#38e0c8",
  accent: "#22c55e",
  danger: "#f43e5e",
  warning: "#fbbf24",
  muted: "#8290b2",
  fg: "#e8eef9",
  card: "#10172c",
  border: "#202f52",
  axis: "#737373",
} as const;

// Distinct hues for stacked shareholding categories. Keep these stable —
// the legend and area colors share this map.
export const SHAREHOLDER_PALETTE = {
  Promoter: CHART_COLORS.brand,
  FII: CHART_COLORS.brand2,
  DII: CHART_COLORS.accent,
  MF: CHART_COLORS.warning,
  Insurance: "#a78bfa",
  Retail: CHART_COLORS.muted,
  Others: "#64748b",
} as const;

export type ShareholderCategory = keyof typeof SHAREHOLDER_PALETTE;

// Shared category definitions used by both the latest-quarter tiles and the
// quarterly sparklines, so colors/labels/picks can't drift between the two.
export type ShareholdingCategory = {
  key: "promoter" | "fii" | "dii" | "retail" | "others";
  label: string;
  color: string;
  pick: (b: {
    promoter: number; fii: number; dii: number;
    retail: number; bodies: number; others: number;
  }) => number;
};

export const SHAREHOLDING_CATEGORIES: ShareholdingCategory[] = [
  { key: "promoter", label: "Promoter", color: SHAREHOLDER_PALETTE.Promoter, pick: (b) => b.promoter },
  { key: "fii",      label: "FII",      color: SHAREHOLDER_PALETTE.FII,      pick: (b) => b.fii },
  { key: "dii",      label: "DII",      color: SHAREHOLDER_PALETTE.DII,      pick: (b) => b.dii },
  { key: "retail",   label: "Retail",   color: SHAREHOLDER_PALETTE.Retail,   pick: (b) => b.retail },
  { key: "others",   label: "Others",   color: SHAREHOLDER_PALETTE.Others,   pick: (b) => b.bodies + b.others },
];
