"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Small hover-triggered card. Wrap any cell content as `trigger`; `panel` is
// shown in a floating card positioned below it while the mouse is over either.
//
// The popup is rendered through a portal into document.body and positioned
// with getBoundingClientRect + position:fixed, rather than as a CSS-absolute
// child of the trigger. This matters because triggers are frequently inside
// scrolling containers (e.g. every cell of the Tasks table sits inside the
// table's own `overflow-x-auto` wrapper) - a CSS-absolute popup gets silently
// clipped by the nearest scrolling ancestor whenever it would render outside
// that ancestor's box. That's exactly why this previously "worked" for the
// Description column (plenty of table width to its right to render into) but
// not for columns near the table's right edge (Project No, Work-Order No,
// Tender No, Assigned To) - their popups had nowhere to go but got cut off.
// Portaling to the body sidesteps every such ancestor entirely.
export default function HoverPanel({
  trigger,
  panel,
  panelClassName = "w-72",
}: {
  trigger: ReactNode;
  panel: ReactNode;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Provisional position under the trigger; refined below once the panel's
    // real size is known, before the browser paints (no visible jump).
    setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  // Clamp the panel to stay fully within the viewport (flip above the
  // trigger / align to its right edge if there isn't room below/right)
  // instead of letting it overflow off-screen.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    const panelEl = panelRef.current;
    if (!rect || !panelEl) return;
    const margin = 8;
    const panelWidth = panelEl.offsetWidth;
    const panelHeight = panelEl.offsetHeight;

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - margin) {
      left = rect.right - panelWidth;
    }
    left = Math.max(margin, left);

    let top = rect.bottom + 4;
    if (top + panelHeight > window.innerHeight - margin) {
      top = rect.top - panelHeight - 4;
    }
    top = Math.max(margin, top);

    setPos({ top, left });
  }, [open]);

  return (
    <div
      ref={triggerRef}
      className="relative inline-block max-w-full cursor-default"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {trigger}
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className={`z-50 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/10 ${panelClassName}`}
              onMouseEnter={show}
              onMouseLeave={hide}
            >
              {panel}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}