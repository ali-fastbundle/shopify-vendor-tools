"use client";

import React, { useEffect, useRef, useState } from "react";
import { LinkSimple, Check } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";

/*
 * Copy the address of the thing you are looking at.
 *
 * This replaced the word "permalink" next to the category in the detail modal.
 * That link was correct and nobody used it: it was four letters of grey type
 * that did not say what it would do, and the one thing somebody wants from it
 * is the URL on the clipboard rather than a second page open.
 *
 * It lives in its own file for the same reason Pill does. It is on the tool
 * modal and on every entry in the feed, and the rule is that the control that
 * gives you a link looks the same wherever a link is worth giving. A second
 * copy of these lines is how it ends up saying "Copy link" in one place and
 * "Copy URL" in another.
 *
 * Discreet on purpose: no fill, no accent, 12px muted type. Green is the
 * action colour and this is not one of green's three jobs (invariant C), and
 * a copy control that competes with "Visit site" is a copy control in the
 * wrong place.
 *
 * `path` is site-relative. It is resolved against the current origin at click
 * time rather than at render, so the link copied on a preview deployment
 * points at that preview and the one copied in production points at
 * production. Nothing needs to know the canonical host.
 */

/*
 * Two ways, because the first one is not always there. `navigator.clipboard`
 * needs a secure context, so it is absent on plain http, which includes some
 * people's own dev servers and a few corporate proxies. The textarea and
 * execCommand path is deprecated and still works everywhere, which is the
 * whole argument for keeping it behind the modern one.
 */
async function toClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through and try the old way */ }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "-1000px";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyLink({
  path,
  label = "Copy link",
  title = "Copy a link to this",
  size = F.xs,
}) {
  /* idle | done | failed */
  const [state, setState] = useState("idle");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick(e) {
    /* Inside a card or a modal header, so it must not also open the thing. */
    e.preventDefault();
    e.stopPropagation();

    let url = path;
    try { url = new URL(path, window.location.href).href; } catch { /* keep the path */ }

    const ok = await toClipboard(url);
    setState(ok ? "done" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }

  const done = state === "done";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="press inline-flex items-center"
      style={{
        gap: S.xs, background: "transparent", border: 0, padding: 0,
        /* Confirmed reads in the text colour, not the accent. Green has three
           jobs on this site and "something just happened" is not one of them. */
        color: done ? C.text : C.muted,
        fontSize: size, fontWeight: 500, fontFamily: "inherit",
        cursor: "pointer", lineHeight: 1.6, whiteSpace: "nowrap",
      }}
    >
      {done ? <Check size={size} weight="bold" /> : <LinkSimple size={size} />}
      {/*
        * The label is the confirmation. A separate toast would be a second
        * thing appearing somewhere else on the page to say what the button
        * could say itself, and aria-live means it is announced rather than
        * only seen.
        */}
      <span aria-live="polite">
        {done ? "Copied" : state === "failed" ? "Could not copy" : label}
      </span>
    </button>
  );
}
