"use client";

import React from "react";
import { ThumbsUp, ThumbsDown } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";

/*
 * Like and dislike, the one control every section's cards and pages use: the
 * tool grid, the newsletter and event cards, and Engagement on a listing.
 * Defined once for the reason Pill is: it has to look the same everywhere.
 *
 * Liking is an action, so the active state is the action colour. Disliking is
 * the same action pointed the other way, not a warning, so it is neutral.
 *
 * It stops propagation itself, so a vote on a card never opens the card
 * whatever the card does with a click.
 */
export default function Vote({ dir, active, n, onClick, label }) {
  const on = dir === 1
    ? { background: C.accent, color: C.onAccent, border: C.accent }
    : { background: C.text, color: C.bg, border: C.text };
  const Icon = dir === 1 ? ThumbsUp : ThumbsDown;
  return (
    <button type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      aria-pressed={active} aria-label={label || (dir === 1 ? "Like" : "Dislike")}
      className="press flex items-center tnum" style={{
        gap: S.xs, background: active ? on.background : C.subtle,
        color: active ? on.color : C.muted,
        border: `1px solid ${active ? on.border : C.line}`, borderRadius: R.control,
        padding: "4px 8px", fontSize: F.xs, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
      }}>
      <Icon size={13} weight={active ? "fill" : "regular"} /><span>{n}</span>
    </button>
  );
}
