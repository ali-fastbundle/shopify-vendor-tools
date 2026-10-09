"use client";

import React, { useMemo, useState } from "react";
import { MapPin } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";

/*
 * "Events near me", for the in-person events with a known city.
 *
 * Location is asked for only when somebody presses the button, never on
 * load: a permission prompt nobody asked for is the fastest way to get the
 * answer "block", and then the feature is gone for that visitor for good.
 *
 * The coordinates never leave the browser. Distance is computed here, against
 * city-level coordinates the page already carries (geocoded once, committed in
 * lib/eventCoords.js). There is no fetch in this file, nothing is stored, and
 * nothing is logged, so there is no route a location could reach even by
 * mistake. Pressing Clear drops it from memory.
 *
 * If location is refused or unavailable, a country picker does the same job
 * by hand, and it is also there for anybody who would rather not share.
 *
 * Rows are anchors with `data-event`, so a plain click opens the same modal as
 * the timeline (EventDialog) and everything else gets the event's page.
 */
const EARTH_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
export function kmBetween(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const fmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
/* City-level coordinates cannot say anything finer than "in your city". */
const kmLabel = (km) => (km < 15 ? "In your city" : `${fmt.format(Math.round(km / 10) * 10)} km`);

const pill = {
  background: "transparent", border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "8px 14px", fontSize: F.sm, fontWeight: 600, color: C.text,
  cursor: "pointer", fontFamily: "inherit",
};
const quiet = {
  background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
  fontSize: F.sm, color: C.muted, textDecoration: "underline",
};

export default function NearbyEvents({ events = [] }) {
  // idle | asking | located | denied | country
  const [mode, setMode] = useState("idle");
  const [here, setHere] = useState(null);
  const [country, setCountry] = useState("");
  const [why, setWhy] = useState("");

  const countries = useMemo(
    () => [...new Set(events.map((e) => e.country).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [events],
  );

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setWhy("This browser cannot share a location."); setMode("denied"); return;
    }
    setMode("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMode("located");
      },
      (err) => {
        setWhy(err && err.code === 1 ? "Location is off for this site." : "Your location could not be found just now.");
        setMode("denied");
      },
      // City-level matching needs nothing precise, and a recent fix will do.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  }

  function clear() { setHere(null); setCountry(""); setWhy(""); setMode("idle"); }

  const rows = useMemo(() => {
    if (mode === "located" && here) {
      return events.filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng))
        .map((e) => ({ ...e, km: kmBetween(here, e) }))
        .sort((a, b) => a.km - b.km || String(a.date).localeCompare(String(b.date)))
        .slice(0, 8);
    }
    if (country) {
      return events.filter((e) => e.country === country)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }
    return [];
  }, [mode, here, country, events]);

  const picker = (
    <label className="inline-flex items-center" style={{ gap: S.sm, fontSize: F.sm, color: C.muted }}>
      Country
      <select value={country} onChange={(e) => { setCountry(e.target.value); setHere(null); if (mode !== "denied") setMode("country"); }}
        style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
          padding: "6px 10px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
        }}>
        <option value="" style={{ background: C.panel }}>Choose one</option>
        {countries.map((c) => <option key={c} value={c} style={{ background: C.panel }}>{c}</option>)}
      </select>
    </label>
  );

  return (
    <section aria-label="Events near you" style={{ marginTop: S.md }}>
      <div className="flex flex-wrap items-center" style={{ gap: S.md }}>
        {mode === "idle" && (
          <>
            <button onClick={locate} className="press inline-flex items-center" style={{ ...pill, gap: S.xs }}>
              <MapPin size={15} weight="regular" /> Events near me
            </button>
            <button onClick={() => setMode("country")} style={quiet}>or pick a country</button>
          </>
        )}
        {mode === "asking" && <span style={{ fontSize: F.sm, color: C.muted }}>Asking your browser where you are…</span>}
        {(mode === "denied" || mode === "country") && (
          <>
            {mode === "denied" && <span style={{ fontSize: F.sm, color: C.muted }}>{why} Pick a country instead.</span>}
            {picker}
          </>
        )}
        {mode !== "idle" && mode !== "asking" && <button onClick={clear} style={quiet}>Clear</button>}
      </div>

      {mode === "located" && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 0`, lineHeight: 1.5 }}>
          Nearest upcoming events first, by city. Your location stayed in this browser: it was not sent anywhere or saved.
        </p>
      )}

      {rows.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0`, borderTop: `1px solid ${C.line}` }}>
          {rows.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between"
              style={{ gap: S.md, padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.line}` }}>
              <span style={{ minWidth: 0 }}>
                <a href={`/events/${e.id}`} data-event={e.id}
                  style={{ color: C.text, fontWeight: 700, fontSize: F.md, textDecoration: "none" }}>{e.name}</a>
                <span style={{ display: "block", fontSize: F.sm, color: C.muted, marginTop: 2 }}>
                  {[e.label, [e.city, e.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                </span>
              </span>
              {"km" in e && (
                <span className="tnum" style={{ fontSize: F.sm, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>
                  {kmLabel(e.km)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {mode === "country" && country && rows.length === 0 && (
        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.sm}px 0 0` }}>Nothing upcoming there yet.</p>
      )}
    </section>
  );
}
