"use client";

/*
 * The verified owner's screenshots and demo link (lib/media.js), inside the
 * owner panel on a tool. Up to four screenshots, each with alt text, resized
 * in the browser before it is sent. A submission waits for an editor, and the
 * panel says so rather than pretending it is live.
 */
import React, { useEffect, useState } from "react";
import { C, S, R, F } from "@/lib/tools";
import { MEDIA_LIMITS } from "@/lib/limits";

/* Resize to at most 1600px wide and re-encode as JPEG, which also drops any
   metadata in the original file. */
function resize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MEDIA_LIMITS.maxWidth / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ data: c.toDataURL("image/jpeg", 0.85), width: c.width, height: c.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file is not an image this browser can read.")); };
    img.src = url;
  });
}

const field = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control, padding: "4px 8px", fontSize: F.sm, color: C.text, fontFamily: "inherit" };

export default function MediaEditor({ tool }) {
  const [shots, setShots] = useState([]);
  const [video, setVideo] = useState("");
  const [pending, setPending] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/media?tool=${encodeURIComponent(tool.id)}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return;
      setShots((d.live?.screenshots || []).map((s) => ({ path: s.path, alt: s.alt, preview: s.path })));
      setVideo(d.live?.video?.url || "");
      setPending(d.pending);
    }).catch(() => {});
  }, [tool.id]);

  async function add(file) {
    if (!file) return;
    try {
      const r = await resize(file);
      setShots((s) => [...s, { data: r.data, width: r.width, height: r.height, alt: "", preview: r.data }].slice(0, MEDIA_LIMITS.screenshots));
    } catch (e) { setMsg(e.message); }
  }

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: tool.id, video, screenshots: shots.map((s) => (s.path ? { path: s.path, alt: s.alt } : { data: s.data, width: s.width, height: s.height, alt: s.alt })) }),
      });
      if (!res.ok) { setMsg(await res.text()); return; }
      setPending((await res.json()).pending);
      setMsg("Sent. An editor reviews it before it shows on the listing, and you get an email either way.");
    } catch { setMsg("Could not reach the server."); } finally { setBusy(false); }
  }

  const ready = shots.every((s) => s.alt.trim().length >= MEDIA_LIMITS.altMin) && (shots.length || video.trim());
  return (
    <div style={{ marginTop: S.md, borderTop: `1px solid ${C.line}`, paddingTop: S.md }}>
      <p style={{ fontSize: F.sm, fontWeight: 600, margin: 0 }}>Screenshots and a demo video</p>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>
        Up to {MEDIA_LIMITS.screenshots} screenshots, each with alt text that says what it shows, and one video link (YouTube, Vimeo,
        Loom, Wistia or your own site). They show on the listing labelled as supplied by you, after an editor approves them.
        They do not change the caveat or any other part of the listing.
      </p>
      {pending && <p style={{ fontSize: F.xs, color: C.warnInk, margin: `${S.xs}px 0 0` }}>A set you sent on {String(pending.submittedAt).slice(0, 10)} is waiting for review. Sending again replaces it.</p>}
      <div className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.sm }}>
        {shots.map((s, i) => (
          <div key={i} style={{ width: 200 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.preview} alt={s.alt || "Screenshot without alt text yet"} style={{ width: 200, height: "auto", border: `1px solid ${C.line}`, borderRadius: R.control }} />
            <input value={s.alt} onChange={(e) => setShots((x) => x.map((y, j) => (j === i ? { ...y, alt: e.target.value } : y)))}
              placeholder="What it shows (required)" aria-label={`Alt text for screenshot ${i + 1}`} maxLength={MEDIA_LIMITS.alt} style={{ ...field, width: "100%", marginTop: S.xs }} />
            <button type="button" onClick={() => setShots((x) => x.filter((_, j) => j !== i))}
              style={{ background: "none", border: 0, padding: 0, color: C.muted, fontSize: F.xs, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Remove</button>
          </div>
        ))}
      </div>
      {shots.length < MEDIA_LIMITS.screenshots && (
        <label style={{ ...field, display: "inline-block", marginTop: S.sm, cursor: "pointer", fontSize: F.xs }}>
          Add a screenshot
          <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { add(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      <input value={video} onChange={(e) => setVideo(e.target.value.trim())} placeholder="https:// link to a demo video (optional)" aria-label="Demo video link"
        style={{ ...field, width: "100%", marginTop: S.sm }} />
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
        <button type="button" onClick={submit} disabled={!ready || busy} className="press"
          style={{ background: ready ? C.accent : C.subtle, color: ready ? C.onAccent : C.dim, border: 0, borderRadius: R.control, padding: "6px 14px", fontSize: F.sm, fontWeight: 700, cursor: ready ? "pointer" : "default", fontFamily: "inherit" }}>
          {busy ? "Sending" : "Send for review"}
        </button>
        {msg && <span style={{ fontSize: F.xs, color: C.muted }}>{msg}</span>}
      </div>
    </div>
  );
}
