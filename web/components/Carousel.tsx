"use client";

import { useRef } from "react";

/** Horizontal scroller with previous/next buttons. Also scrolls by touch, trackpad, and keyboard. */
export function Carousel({ label, heading, children }: { label: string; heading: React.ReactNode; children: React.ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  const move = (direction: 1 | -1) => {
    const el = list.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.8), behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <div className="stack-sm">
      <div className="row between">
        {heading}
        <div className="row">
          <button type="button" className="icon-btn" onClick={() => move(-1)} aria-label={`Previous ${label}`}>
            ←
          </button>
          <button type="button" className="icon-btn" onClick={() => move(1)} aria-label={`Next ${label}`}>
            →
          </button>
        </div>
      </div>
      <ul className="carousel" ref={list} aria-label={label} tabIndex={0}>
        {children}
      </ul>
    </div>
  );
}
