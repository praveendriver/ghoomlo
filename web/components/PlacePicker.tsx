"use client";

import Image from "next/image";
import { useRef } from "react";
import { DESTINATION_PHOTOS } from "@/lib/photos";

const IN_CAROUSEL = 8;

/**
 * Destination cards in a swipeable row, with the full set in a pop-up.
 * Selection lives in the parent; hidden inputs carry it in the form.
 */
export function PlacePicker({
  places,
  picked,
  max,
  onChange,
}: {
  places: readonly string[];
  picked: string[];
  max: number;
  onChange: (next: string[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const full = picked.length >= max;
  const toggle = (p: string) => onChange(picked.includes(p) ? picked.filter((x) => x !== p) : full ? picked : [...picked, p]);
  // Keep anything already picked in the row, even if it came from the pop-up.
  const row = [...places.slice(0, IN_CAROUSEL), ...picked.filter((p) => places.indexOf(p) >= IN_CAROUSEL)];

  const tile = (p: string, size: string) => {
    const on = picked.includes(p);
    return (
      <button type="button" key={p} className={`pick${on ? " on" : ""}`} aria-pressed={on} disabled={!on && full} onClick={() => toggle(p)}>
        <Image src={DESTINATION_PHOTOS[p]} alt="" fill sizes={size} />
        <span className="pick-tick" aria-hidden="true">
          ✓
        </span>
        <span className="pick-name">{p}</span>
      </button>
    );
  };

  return (
    <div className="stack-sm">
      {picked.map((p) => (
        <input key={p} type="hidden" name="wishlist" value={p} />
      ))}
      <div className="row between">
        <span className="hint" role="status">
          Pick up to {max}. {picked.length > 0 && `${picked.length} picked: ${picked.join(", ")}.`}
        </span>
        <button type="button" className="btn quiet" onClick={() => dialog.current?.showModal()}>
          See all {places.length} places
        </button>
      </div>
      <div className="pick-row">
        {row.map((p) => tile(p, "160px"))}
        <button type="button" className="pick more" onClick={() => dialog.current?.showModal()}>
          <span className="pick-name">
            +{places.length - IN_CAROUSEL} more
            <br />
            <span className="small">See all</span>
          </span>
        </button>
      </div>

      <dialog
        ref={dialog}
        className="ycal-dialog"
        aria-labelledby="places-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="ycal-panel stack">
          <div className="row between">
            <h3 id="places-title">Where would you love to go?</h3>
            <button type="button" className="btn quiet" onClick={() => dialog.current?.close()} autoFocus>
              Done
            </button>
          </div>
          <p className="small muted" role="status">
            Pick up to {max}. {picked.length} picked.
          </p>
          <div className="pick-grid">{places.map((p) => tile(p, "(max-width: 600px) 45vw, 190px"))}</div>
        </div>
      </dialog>
    </div>
  );
}
