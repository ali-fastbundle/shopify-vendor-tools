"use client";

import React, { useEffect, useRef, useState } from "react";
import { C, R, S, TRACK } from "@/lib/tools";

/*
 * An event's mark, through the same chain a tool's goes through: a hosted file
 * under /public/logos/, then the favicon service against the event's own
 * domain, then a lettermark. Each step is the fallback for the one before.
 *
 * Expect the lettermark to be common. A lot of these are annual or one-off
 * events on thin sites or on a ticketing platform, and the favicon service
 * answers a domain it knows nothing about with a 16px globe and a 404. That
 * globe is the failure state that looks like one, so anything under 32px wide
 * goes to the lettermark rather than being stretched into a blur. The check
 * runs on load and again after hydration, because a cached image can finish
 * loading before React is listening for it.
 *
 * The lettermark is drawn on purpose rather than as an apology: heavy, tight
 * initials in a square the same size as a real mark, two of them where there
 * is room and one below 32px, coloured by status the same way the rest of the
 * row is. Upcoming is full text on the subtle tile, imminent takes the neutral
 * inversion, past recedes to the dim tone with no fill. No category colour
 * (invariant A).
 */

const STOP = new Set(["the", "a", "an", "at", "of", "for", "and", "on", "in"]);

/* "The Wide Event" -> "WE", "DotDev" -> "DD", "ShopX" -> "SX", "DMEXCO" -> "DM". */
export function initialsOf(name) {
  const words = String(name || "")
    .replace(/['’]\d{2}\b/g, "")
    .split(/[^A-Za-z0-9À-ɏ]+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0] || "?";
  const caps = w.slice(1).match(/[A-Z]/);
  if (caps && /[a-z]/.test(w)) return (w[0] + caps[0]).toUpperCase();
  return w.slice(0, 2).toUpperCase();
}

export function Lettermark({ e, size, status }) {
  const past = status === "past";
  const now = status === "imminent";
  /* Two initials need room. Below 32px they were 9px type in a 24px box and
     read as a broken image, so a small mark carries one initial, heavier. */
  const text = size < 32 ? initialsOf(e.name)[0] : initialsOf(e.name);
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: R.card, flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: now ? C.text : past ? "transparent" : C.subtle,
      color: now ? C.bg : past ? C.dim : C.text,
      border: `1px solid ${now ? C.text : past ? C.line : C.edge}`,
      fontWeight: 800, fontSize: Math.round(size * (text.length === 1 ? 0.5 : 0.38)),
      letterSpacing: TRACK.tight, lineHeight: 1,
    }}>{text}</span>
  );
}

export default function EventLogo({ e, size = 28, status }) {
  const first = e.logo ? "logo" : e.domain ? "favicon" : "letter";
  const [step, setStep] = useState(first);
  const ref = useRef(null);
  const next = () => setStep((s) => (s === "logo" && e.domain ? "favicon" : "letter"));

  const check = (img) => {
    if (img && img.complete && img.naturalWidth > 0 && img.naturalWidth < 32) next();
  };
  useEffect(() => { check(ref.current); }, [step]);

  if (step === "letter") return <Lettermark e={e} size={size} status={status} />;

  return (
    <img referrerPolicy="no-referrer"
      ref={ref}
      src={step === "logo" ? e.logo : `https://www.google.com/s2/favicons?domain=${e.domain}&sz=128`}
      alt={`${e.name} logo`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={next}
      onLoad={(ev) => check(ev.currentTarget)}
      style={{
        width: size, height: size, borderRadius: R.card, flexShrink: 0,
        background: "#FFFFFF", objectFit: "contain", padding: size >= 40 ? S.xs : 2,
        /* Past recedes with the rest of the row. */
        opacity: status === "past" ? 0.55 : 1,
      }}
    />
  );
}
