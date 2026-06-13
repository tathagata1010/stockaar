"use client";

import { useEffect, useMemo, useState } from "react";
import { CHART_COLORS as DARK } from "@/lib/chart-theme";

const LIGHT: ChartColors = {
  brand: "#3b6fd0",
  brand2: "#0fb5a0",
  accent: "#16a34a",
  danger: "#dc2626",
  warning: "#d97706",
  muted: "#5c687e",
  fg: "#0e1525",
  card: "#ffffff",
  border: "#e0e6f0",
  axis: "#94a3b8",
};

export type ChartColors = {
  brand: string;
  brand2: string;
  accent: string;
  danger: string;
  warning: string;
  muted: string;
  fg: string;
  card: string;
  border: string;
  axis: string;
};

function read(): { colors: ChartColors; isLight: boolean } {
  if (typeof document === "undefined") return { colors: DARK, isLight: false };
  const isLight = document.documentElement.dataset.theme === "light";
  return { colors: isLight ? LIGHT : DARK, isLight };
}

export function useChartTheme() {
  const [state, setState] = useState(read);

  useEffect(() => {
    setState(read());
    const target = document.documentElement;
    const obs = new MutationObserver(() => setState(read()));
    obs.observe(target, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const { colors, isLight } = state;
  // Recharts treats new prop identity as a change and re-mounts tooltips;
  // memoize so identity only flips when the theme actually flips.
  return useMemo(
    () => {
      const tooltipStyle = {
        background: isLight ? "rgba(255, 255, 255, 0.98)" : "rgba(16, 23, 44, 0.96)",
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        color: colors.fg,
        fontSize: 12,
        padding: "8px 10px",
        boxShadow: isLight
          ? "0 4px 12px rgba(15, 23, 42, 0.08)"
          : "0 4px 12px rgba(0, 0, 0, 0.5)",
      } as const;
      // Recharts paints each tooltip row with its own itemStyle (default
      // black). Without these, dark-mode tooltips render unreadable text on
      // a dark background.
      const itemStyle = { color: colors.fg, fontSize: 12 } as const;
      const labelStyle = { color: colors.muted, fontSize: 11 } as const;
      return {
        colors,
        isLight,
        tooltipStyle,
        itemStyle,
        labelStyle,
        cursorFill: isLight ? "rgba(99, 152, 255, 0.10)" : "rgba(99, 152, 255, 0.14)",
      };
    },
    [colors, isLight],
  );
}
