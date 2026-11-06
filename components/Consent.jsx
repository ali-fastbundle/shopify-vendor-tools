"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { X } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";
import { CONSENT_EVENT, CONSENT_OPEN, readConsent, writeConsent, withdrawGa, gaConfigured, GA_ID } from "@/lib/consent";

/*
 * The consent banner and the only place Google Analytics can load
 * (CLAUDE.md, "Privacy and consent").
 *
 * - Nothing renders, and nothing loads, until this has read the stored choice
 *   in the browser. The server HTML carries no GA script and no banner.
 * - GA mounts only on "granted". No choice, a reject, a dismissed banner or
 *   blocked storage all mean it never mounts.
 * - Accept and Reject are the same control, the same size and weight, side by
 *   side. Closing the banner or pressing Escape rejects.
 * - "Cookie settings" in the footer (CONSENT_OPEN) shows it again. Rejecting
 *   after an accept stops GA, deletes its cookies and reloads the page.
 * - With no NEXT_PUBLIC_GA_ID there is nothing to consent to, so there is no
 *   banner at all.
 */
export default function Consent() {
  const [choice, setChoice] = useState(undefined); // undefined until read in the browser
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!gaConfigured()) return;
    const c = readConsent();
    setChoice(c);
    setOpen(c === null);
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN, reopen);
    return () => window.removeEventListener(CONSENT_OPEN, reopen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") decide("denied"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!gaConfigured()) return null;

  function decide(value) {
    const was = choice;
    const v = writeConsent(value);
    setChoice(v);
    setOpen(false);
    if (was === "granted" && v === "denied") {
      withdrawGa();
      window.location.reload();
    }
  }

  const btn = {
    fontFamily: "inherit", fontSize: F.sm, fontWeight: 600, color: C.text, background: C.panel,
    border: `1px solid ${C.line}`, borderRadius: R.control, padding: "6px 16px", cursor: "pointer", minWidth: 96,
  };

  return (
    <>
      {choice === "granted" && <GoogleAnalytics gaId={GA_ID} />}
      {open && (
        <section role="region" aria-label="Analytics consent" style={{
          position: "fixed", left: S.lg, right: S.lg, bottom: S.lg, zIndex: 60, marginLeft: "auto", maxWidth: 560,
          background: C.panel, color: C.text, border: `1px solid ${C.line}`, borderRadius: R.card,
          boxShadow: C.shadowMd, padding: S.lg,
        }}>
          <div className="flex items-start justify-between" style={{ gap: S.md }}>
            <p style={{ fontSize: F.sm, lineHeight: 1.55, margin: 0, maxWidth: "none" }}>
              Can we use Google Analytics to count which pages are read? It sets cookies and sends
              your visit to Google. Nothing loads unless you accept, and you can change your mind
              from Cookie settings at the foot of the menu.{" "}
              <a href="/privacy" style={{ color: C.text, textDecoration: "underline" }}>Privacy</a>
            </p>
            <button type="button" aria-label="Close, which rejects" title="Close, which rejects"
              onClick={() => decide("denied")} className="press"
              style={{ background: "none", border: 0, padding: S.xs, cursor: "pointer", color: C.muted, flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.md }}>
            <button type="button" className="ctl press" style={btn} onClick={() => decide("denied")}>Reject</button>
            <button type="button" className="ctl press" style={btn} onClick={() => decide("granted")}>Accept</button>
          </div>
        </section>
      )}
    </>
  );
}

/** The footer control that shows the banner again. Renders nothing without GA. */
export function ConsentSettings({ style }) {
  if (!gaConfigured()) return null;
  return (
    <button type="button" className="press" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit", ...style }}
      onClick={() => { try { window.dispatchEvent(new CustomEvent(CONSENT_OPEN)); } catch { /* ignore */ } }}>
      Cookie settings
    </button>
  );
}
