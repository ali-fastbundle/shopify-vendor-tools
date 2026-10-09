"use client";

import React, { useEffect, useImperativeHandle, useRef } from "react";

/*
 * A multi-line field that grows with what is typed into it.
 *
 * Enter makes a new line. It does not submit.
 *
 * The review box used to be a single-line input with `Enter` wired to submit,
 * which is the shape of a search box, not of a place to write a paragraph.
 * People wrote two sentences, reached for a line break, and posted half a
 * review instead. Nobody reports that. They just do not come back.
 *
 * Cmd or Ctrl plus Enter still submits, for anyone who expects a keyboard way
 * out of a text box, and the button is always the obvious one.
 */
const GrowText = React.forwardRef(function GrowText(
  { value, onChange, onSubmit, rows = 2, maxRows = 12, style, ...rest }, ref,
) {
  const own = useRef(null);
  /* The node either way, whether the caller passed an object ref, a callback
     ref, or nothing at all. */
  useImperativeHandle(ref, () => own.current, []);

  /* Height follows the content: reset to auto so the box can shrink again when
     text is deleted, then take the scroll height. Floored at `rows` so an empty
     box still reads as somewhere to write a paragraph, and capped at `maxRows`
     so a long review does not push the Post button off the screen. */
  useEffect(() => {
    const node = own.current;
    if (!node) return;
    node.style.height = "auto";
    const cs = getComputedStyle(node);
    const line = parseFloat(cs.lineHeight) || 20;
    const border = node.offsetHeight - node.clientHeight;
    const chrome = border + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const wanted = node.scrollHeight + border;
    const min = line * rows + chrome;
    const max = line * maxRows + chrome;
    node.style.height = `${Math.min(Math.max(wanted, min), max)}px`;
    node.style.overflowY = wanted > max ? "auto" : "hidden";
  }, [value, rows, maxRows]);

  return (
    <textarea
      ref={own}
      rows={rows}
      value={value}
      onChange={onChange}
      onKeyDown={(e) => {
        if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSubmit();
        }
      }}
      style={{ resize: "none", lineHeight: 1.5, display: "block", ...style }}
      {...rest}
    />
  );
});

export default GrowText;
