"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type MapPin = { n: number; title: string; lat: number; lng: number };

const pinSvg = (n: number) =>
  `<svg viewBox="0 0 30 40" width="30" height="40" aria-hidden="true"><path d="M15 39C6 27 2 21.5 2 15a13 13 0 1 1 26 0c0 6.5-4 12-13 24z" fill="#15211c"/><circle cx="15" cy="15" r="8.5" fill="#fffdf8"/><text x="15" y="19.2" text-anchor="middle" font-size="12" font-weight="700" fill="#15211c" font-family="system-ui,sans-serif">${n}</text></svg>`;

/** Defines the wobble filter the map tiles use. Render once per page. */
export function MapSketchFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="map-sketch" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
      </filter>
    </svg>
  );
}

/**
 * A real map of one day's stops, on OpenStreetMap tiles. Pin positions come
 * from a place search, so they can be wrong; the caption says so.
 */
export function DayMap({ day, pins }: { day: number; pins: MapPin[] }) {
  const canvas = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(pins);

  useEffect(() => {
    const points: MapPin[] = JSON.parse(key);
    let cancelled = false;
    let cleanup = () => {};
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !canvas.current) return;
      const map = L.map(canvas.current, {
        // The page should scroll normally over the map; use the buttons or drag to move it.
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile,
        keyboard: false,
      });
      cleanup = () => map.remove();
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);
      if (latLngs.length > 1) {
        L.polyline(latLngs, { color: "#15211c", weight: 3, dashArray: "1 9", lineCap: "round", interactive: false }).addTo(map);
      }
      for (const p of points) {
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: "map-pin", html: pinSvg(p.n), iconSize: [30, 40], iconAnchor: [15, 39] }),
          title: `${p.n}. ${p.title}`,
          keyboard: false,
          interactive: false,
        }).addTo(map);
      }
      if (latLngs.length === 1) map.setView(latLngs[0], 14);
      else map.fitBounds(latLngs, { paddingTopLeft: [40, 56], paddingBottomRight: [40, 24], maxZoom: 15 });
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [key]);

  return (
    <figure className="daymap">
      <div className="daymap-frame">
        <div ref={canvas} className="daymap-canvas" role="img" aria-label={`Map of day ${day}: ${pins.map((p) => `${p.n}. ${p.title}`).join("; ")}`} />
      </div>
      <figcaption>
        Pins are placed by an OpenStreetMap place search and may be off; check each location before you go.
        {pins.length > 1 && " The dotted line shows the order of stops, not the road route."}
      </figcaption>
    </figure>
  );
}
