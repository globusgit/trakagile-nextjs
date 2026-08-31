"use client";

import { ReactNode } from "react";

// Small hover-triggered card. Wrap any cell content as `trigger`; `panel` is
// shown in a floating card positioned below it while the mouse is over either.
export default function HoverPanel({
  trigger,
  panel,
  panelClassName = "w-72",
}: {
  trigger: ReactNode;
  panel: ReactNode;
  panelClassName?: string;
}) {
  return (
    <div className="group relative inline-block max-w-full">
      {trigger}
      <div
        className={`pointer-events-none absolute left-0 top-full z-30 mt-1 rounded-lg border bg-popover p-3 text-xs text-popover-foreground opacity-0 shadow-lg ring-1 ring-foreground/10 transition-opacity duration-150 group-hover:opacity-100 ${panelClassName}`}
      >
        {panel}
      </div>
    </div>
  );
}