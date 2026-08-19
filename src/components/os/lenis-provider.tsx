"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { registerLenis, scrollToId } from "@/lib/scroll";

function scrollToHash(): void {
  const id = window.location.hash.slice(1);
  if (id) scrollToId(id);
}

/**
 * Smooth scrolling via Lenis, with a hard reduced-motion gate.
 *
 * The wrapper stays mounted either way (stable tree, no remount) — for users
 * with prefers-reduced-motion we hand Lenis fully-inert options (no raf loop,
 * no wheel/touch hijack) so the browser scrolls natively and instantly.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setReduced(isReduced), 0);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => {
      clearTimeout(timer);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  // For reduced-motion users the instance stays mounted (stable tree, no
  // remount) but with fully-inert options: no raf loop and no wheel/touch
  // hijack, so the browser scrolls natively and instantly.
  const options = useMemo(
    () => ({ autoRaf: !reduced, smoothWheel: !reduced, smoothTouch: !reduced }),
    [reduced],
  );

  // Route same-page anchor clicks through Lenis so the fixed header is
  // compensated with an offset. Keyboard nav (Tab + Enter on the anchors)
  // goes through the same path.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href === "#") return;
      const id = href.slice(1);
      if (!document.getElementById(id)) return;
      e.preventDefault();
      // Keep the URL hash in sync so deep links, back/forward and copy-link
      // keep working (native anchors used to do this for free).
      history.pushState(null, "", href);
      scrollToId(id);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Back/forward navigation between section hashes.
  useEffect(() => {
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  // Deep links: land on the hashed section once Lenis is ready.
  useEffect(() => {
    if (!window.location.hash) return;
    const t = window.setTimeout(scrollToHash, 120);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <ReactLenis root options={options}>
      <LenisBridge reduced={reduced}>{children}</LenisBridge>
    </ReactLenis>
  );
}

function LenisBridge({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const lenis = useLenis();

  useEffect(() => {
    registerLenis(reduced ? null : (lenis ?? null));
    return () => registerLenis(null);
  }, [lenis, reduced]);

  return <>{children}</>;
}
