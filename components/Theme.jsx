"use client";

import React, { useEffect, useState } from "react";
import { C, S, R, F } from "@/lib/tools";

const KEY = "svt:theme";

/* The page background of each theme, for the browser-chrome meta tag. Kept in
   step with --c-bg in globals.css by hand; there are two values and they are
   the two most visible ones on the site, so a drift shows immediately. */
const CHROME = { dark: "#06110D", light: "#F3F6F4" };

const MODES = [
  ["system", "Auto"],
  ["light", "Light"],
  ["dark", "Dark"],
];

/*
 * Runs before the body paints, so the first frame is already the right theme.
 *
 * globals.css declares dark on :root and light on [data-theme="light"] and
 * nothing else — no prefers-color-scheme copy of either palette — so resolving
 * "system" to a concrete value is this script's job rather than the
 * stylesheet's. That is the trade: one palette per theme in CSS, and a visitor
 * with scripting off gets dark, which is what the site was before there was a
 * choice at all.
 *
 * Every line is inside a try. localStorage throws in a private window with
 * site data blocked, and a theme is not worth taking the page down for.
 */
export const THEME_SCRIPT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(KEY)});
var m=(p==="light"||p==="dark")?p:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");
document.documentElement.setAttribute("data-theme",m);
var t=document.querySelector('meta[name="theme-color"]');
if(t)t.setAttribute("content",m==="light"?${JSON.stringify(CHROME.light)}:${JSON.stringify(CHROME.dark)});
}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}

const systemMode = () =>
  typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

function apply(choice) {
  const resolved = choice === "system" ? systemMode() : choice;
  document.documentElement.setAttribute("data-theme", resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", CHROME[resolved]);
}

/*
 * Auto, Light, Dark — three states, not two.
 *
 * A two-way switch can express "I want light" but not "follow the machine",
 * and once it has been touched there is no way back to the system preference
 * short of clearing site data. Auto is the default and stays selectable.
 */
export function ThemeToggle() {
  /*
   * Starts at the default so the first client render matches the server's.
   * The stored choice arrives a tick later; the theme itself is already
   * correct by then, set by THEME_SCRIPT before any of this ran.
   */
  const [choice, setChoice] = useState("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setChoice(saved);
    } catch { /* storage blocked; Auto it is */ }
  }, []);

  // Only while following the system: a machine that switches at sunset should
  // take the page with it without a reload.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function pick(next) {
    setChoice(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch { /* the choice still holds for this page */ }
  }

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex items-center"
      style={{
        background: C.subtle,
        border: `1px solid ${C.line}`,
        borderRadius: R.control,
        padding: 2,
        gap: 2,
      }}
    >
      {MODES.map(([id, label]) => {
        const on = id === choice;
        return (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            aria-pressed={on}
            style={{
              background: on ? C.panel : "transparent",
              color: on ? C.text : C.dim,
              border: `1px solid ${on ? C.line : "transparent"}`,
              borderRadius: R.control - 2,
              padding: `${S.xs}px ${S.sm}px`,
              fontSize: F.xs,
              fontWeight: on ? 600 : 500,
              lineHeight: 1.3,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
