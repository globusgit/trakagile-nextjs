"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Small hover-triggered card. Wrap any cell content as `trigger`; `panel` is
// shown in a floating card positioned below it while the mouse is over either.
export default function HoverPanel({
  trigger,
  panel,
  panelClassName = "w-72",
  portaled = false,
}: {
  trigger: ReactNode;
  panel: ReactNode;
  panelClassName?: string;
  portaled?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    anchorTop: number;
    anchorBottom: number;
  } | null>(null);

  const showPortaledPanel = (element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const gap = 6;
    setPosition({ left: rect.left, top: rect.bottom + gap, anchorTop: rect.top, anchorBottom: rect.bottom });
  };

  useLayoutEffect(() => {
    if (!position || !panelRef.current) return;

    const gap = 6;
    const panelRect = panelRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(gap, position.left), window.innerWidth - panelRect.width - gap);
    const below = position.anchorBottom + gap;
    const top = below + panelRect.height <= window.innerHeight - gap
      ? below
      : Math.max(gap, position.anchorTop - panelRect.height - gap);

    if (left !== position.left || top !== position.top) {
      setPosition((current) => current ? { ...current, left, top } : current);
    }
  }, [position]);

  const floatingPanel = (
    <div
      className={`pointer-events-none rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/10 ${panelClassName}`}
    >
      {panel}
    </div>
  );

  return (
    <div
      className="group relative inline-block max-w-full"
      onMouseEnter={(event) => { if (portaled) showPortaledPanel(event.currentTarget); }}
      onMouseLeave={() => { if (portaled) setPosition(null); }}
    >
      {trigger}
      {portaled
        ? position && createPortal(
          <div ref={panelRef} className="fixed z-[2100]" style={{ left: position.left, top: position.top }}>{floatingPanel}</div>,
          document.body,
        )
        : <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">{floatingPanel}</div>}
    </div>
  );
}
