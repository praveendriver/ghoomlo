"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Point } from "@/lib/places";
import { MapSketchFilter } from "./DayMap";

type MapState = { map: import("leaflet").Map; layer: import("leaflet").LayerGroup; L: typeof import("leaflet") };

// Labels come from the fixed city and place lists, never from visitor input.
function drawMap(s: MapState | null, origin: Point | null, places: Point[]) {
  if (!s) return;
  const { map, layer, L } = s;
  layer.clearLayers();
  const label = (text: string, home = false) =>
    L.divIcon({ className: "sketch-pin", html: `<span class="sketch-dot${home ? " home" : ""}"></span><span class="sketch-label">${text}</span>`, iconSize: [0, 0] });

  if (origin) L.marker([origin.lat, origin.lon], { icon: label(`🏠 ${origin.name}`, true), interactive: false, keyboard: false }).addTo(layer);
  places.forEach((p, i) => {
    L.marker([p.lat, p.lon], { icon: label(p.name), interactive: false, keyboard: false }).addTo(layer);
    if (!origin) return;
    // A gentle curve from home to the place, bowing alternately left and right.
    const [a, b] = [origin, p];
    const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
    const dx = b.lon - a.lon, dy = b.lat - a.lat;
    const bow = (i % 2 ? -1 : 1) * 0.22;
    const ctrl = { lat: mid.lat + dx * bow, lon: mid.lon - dy * bow };
    const pts: [number, number][] = [];
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const u = 1 - t;
      pts.push([u * u * a.lat + 2 * u * t * ctrl.lat + t * t * b.lat, u * u * a.lon + 2 * u * t * ctrl.lon + t * t * b.lon]);
    }
    L.polyline(pts, { color: "#c2562d", weight: 2.5, dashArray: "2 8", lineCap: "round", interactive: false }).addTo(layer);
  });

  // The map may have been laid out at a different size (e.g. on a phone); measure again first.
  map.invalidateSize();
  const all = [...(origin ? [origin] : []), ...places];
  if (all.length >= 2) map.fitBounds(all.map((p) => [p.lat, p.lon] as [number, number]), { padding: [46, 46], maxZoom: 7 });
  else if (all.length === 1) map.setView([all[0].lat, all[0].lon], 6);
  else map.setView([22.5, 79], 4);
}


/**
 * A sketchy map of the home city with hand-drawn-style flight paths to each
 * picked place. Real geography (OpenStreetMap), styled to look drawn; the
 * curves show "from here to there", not actual flight routes.
 */
export function FareMap({ origin, places }: { origin: Point | null; places: Point[] }) {
  const el = useRef<HTMLDivElement>(null);
  const state = useRef<MapState | null>(null);
  const latest = useRef({ origin, places });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !el.current || state.current) return;
      const map = L.map(el.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      }).setView([22.5, 79], 4);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 12,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      state.current = { map, layer: L.layerGroup().addTo(map), L };
      drawMap(state.current, latest.current.origin, latest.current.places);
    });
    return () => {
      cancelled = true;
      state.current?.map.remove();
      state.current = null;
    };
  }, []);

  const key = JSON.stringify({ origin, places });
  useEffect(() => {
    latest.current = { origin, places };
    drawMap(state.current, origin, places);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = origin
    ? `Map of ${origin.name}${places.length ? ` with paths to ${places.map((p) => p.name).join(", ")}` : ""}`
    : "Map of India";
  return (
    <>
      <MapSketchFilter />
      <div ref={el} className="fare-map" role="img" aria-label={summary} />
    </>
  );
}
