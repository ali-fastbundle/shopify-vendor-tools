/*
 * Input limits shared by a server library and the form that writes to it.
 * Their own module so a client component can read a number without pulling
 * the store (and through it, server code) into the browser bundle.
 */
export const LIST_LIMITS = { lists: 20, items: 50, name: 80, note: 300, byName: 60 };
export const QUESTION_MAX = 600;
export const ANSWER_MAX = 2000;
/* Vendor media (lib/media.js). Four screenshots of at most 600 KB each after
   the browser resizes them keeps one submission under Vercel's 4.5 MB body. */
export const MEDIA_LIMITS = { screenshots: 4, alt: 150, altMin: 5, bytes: 600_000, maxWidth: 1600 };
