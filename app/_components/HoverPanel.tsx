"use client";

import {
  ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// Small hover-triggered card rendered in a body portal so it is never clipped
// by table/scroll containers. A short close delay keeps the card open while
// the pointer moves from the trigger to the floating card.
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

  const [pos, setPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const triggerRef =
    useRef<HTMLDivElement>(null);

  const panelRef =
    useRef<HTMLDivElement>(null);

  const closeTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const cancelHide = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const positionPanel = useCallback(() => {
    const triggerEl =
      triggerRef.current;

    const panelEl =
      panelRef.current;

    if (!triggerEl || !panelEl) {
      return;
    }

    const rect =
      triggerEl.getBoundingClientRect();

    const margin = 8;
    const gap = 6;

    const panelWidth =
      panelEl.offsetWidth;

    const panelHeight =
      panelEl.offsetHeight;

    let left = rect.left;

    /*
     * If the card would go outside the
     * right side of the browser, move it
     * towards the left.
     */
    if (
      left + panelWidth >
      window.innerWidth - margin
    ) {
      left =
        rect.right -
        panelWidth;
    }

    /*
     * Final horizontal viewport clamp.
     */
    left = Math.max(
      margin,
      Math.min(
        left,
        Math.max(
          margin,
          window.innerWidth -
            panelWidth -
            margin,
        ),
      ),
    );

    /*
     * Initially show below the trigger.
     */
    let top =
      rect.bottom + gap;

    /*
     * If there isn't enough room below,
     * show above the trigger.
     */
    if (
      top + panelHeight >
      window.innerHeight - margin
    ) {
      top =
        rect.top -
        panelHeight -
        gap;
    }

    /*
     * Final vertical viewport clamp.
     */
    top = Math.max(
      margin,
      Math.min(
        top,
        Math.max(
          margin,
          window.innerHeight -
            panelHeight -
            margin,
        ),
      ),
    );

    setPos({
      top,
      left,
    });
  }, []);

  const show = useCallback(() => {
    /*
     * If the mouse is moving from the
     * trigger to the popup, cancel the
     * pending close.
     */
    cancelHide();

    const rect =
      triggerRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    /*
     * Give the popup an initial position.
     * The layout effect recalculates it once
     * the actual popup dimensions are known.
     */
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
    });

    setOpen(true);
  }, [cancelHide]);

  const hide = useCallback(() => {
    cancelHide();

    /*
     * Do NOT close immediately.
     *
     * The popup is rendered into document.body,
     * so there is a small gap while the mouse
     * moves from the Task ID to the popup.
     */
    closeTimerRef.current =
      setTimeout(() => {
        setOpen(false);
        closeTimerRef.current = null;
      }, 180);
  }, [cancelHide]);

  /*
   * Recalculate popup position after it has
   * been rendered and whenever the page/table
   * is resized or scrolled.
   */
  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    positionPanel();

    const handleViewportChange = () => {
      if (open) {
        positionPanel();
      }
    };

    window.addEventListener(
      "resize",
      handleViewportChange,
    );

    /*
     * true means capture scroll events from
     * table/container scroll areas as well.
     */
    window.addEventListener(
      "scroll",
      handleViewportChange,
      true,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleViewportChange,
      );

      window.removeEventListener(
        "scroll",
        handleViewportChange,
        true,
      );
    };
  }, [open, positionPanel]);

  /*
   * Cleanup timer when component unmounts.
   */
  useLayoutEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(
          closeTimerRef.current,
        );
      }
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      className="relative inline-block max-w-full cursor-default"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {trigger}

      {open &&
      pos &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
              }}
              className={`
                z-[100]
                max-h-[calc(100vh-16px)]
                overflow-auto
                rounded-lg
                border
                bg-popover
                p-3
                text-xs
                text-popover-foreground
                shadow-xl
                ring-1
                ring-foreground/10
                ${panelClassName}
              `}
              onMouseEnter={cancelHide}
              onMouseLeave={hide}
              onFocus={cancelHide}
              onBlur={hide}
            >
              {panel}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}