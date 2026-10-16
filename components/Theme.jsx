"use client";

import React, { useEffect, useState } from "react";
import { Desktop, Sun, Moon } from "@phosphor-icons/react";
import { C, R } from "@/lib/tools";

const KEY = "svt:theme";

/* The page background of each theme, for the browser-chrome meta tag. Kept in
   step with --c-bg in globals.css by hand; there are two values and they are
   the two most visible ones on the site, so a drift shows immediately. */
const CHROME = { dark: "#141516", light: "#F1F2F3" };

/* The cycle order, and what each state says about itself. */
const MODES = [
  ["system", "Auto, following your system", Desktop],
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
];

/*
 * Runs before the body paints, so the first frame is already the right theme.
 *
 * globals.css declares light on :root and dark on [data-theme="dark"] and
 * nothing else — no prefers-color-scheme copy of either palette — so resolving
 * "system" to a concrete value is this script's job rather than the
 * stylesheet's. That is the trade: one palette per theme in CSS, and a visitor
 * with scripting off gets light, the look the site leads with.
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
 * Auto, Light, Dark: three states, not two, behind one icon button that
 * cycles through them.
 *
 * A two-way switch can express "I want light" but not "follow the machine",
 * and once it has been touched there is no way back to the system preference
 * short of clearing site data. Auto is the default and stays reachable.
 *
 * It was a three-button segmented control, in the header and again in the
 * footer on a phone. Three buttons is three decisions before any content for
 * something most people set once or never, so it is one control, in the
 * header only. The icon shows the current state; the label and tooltip say it
 * and name the next one, so a click is never a guess.
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

  const at = MODES.findIndex(([id]) => id === choice);
  const [, label, Icon] = MODES[at];
  const [nextId, nextLabel] = MODES[(at + 1) % MODES.length];
  const says = `Theme: ${label}. Switch to ${nextLabel.split(",")[0]}.`;

  return (
    <button type="button" onClick={() => pick(nextId)} aria-label={says} title={says}
      className="ctl press"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 36, height: 36, padding: 0, flexShrink: 0,
        background: C.panel, color: C.muted, border: `1px solid ${C.line}`,
        borderRadius: R.control, cursor: "pointer",
      }}>
      <Icon size={18} />
    </button>
  );
}
