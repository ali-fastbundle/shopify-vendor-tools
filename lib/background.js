/*
 * Work that outlives the response.
 *
 * A serverless function is frozen the moment it returns. A promise nobody is
 * waiting on — a notification, a thank-you email — is not "slow", it is simply
 * never finished, and it leaves no error because nothing rejected. That is the
 * exact shape of the bug this exists to fix: the admin test button worked
 * because it awaited, while the same call trailing a visitor's request was
 * dropped on the floor.
 *
 * `waitUntil` tells the platform to keep the instance alive until the promise
 * settles, without making the visitor wait for it — which is the whole point of
 * the fire-and-forget rule in CLAUDE.md. Awaiting instead would fix delivery by
 * making someone else's request wait on Resend, which the rule exists to
 * prevent.
 *
 * Off Vercel — `next start`, local dev, another host — there is no request
 * context to register with. `waitUntil` returns harmlessly there and the
 * process is long-lived anyway, so the promise runs to completion on its own.
 */
import { waitUntil } from "@vercel/functions";

export function background(promise, label = "task") {
  // Attach the catch first: an unhandled rejection registered with waitUntil
  // would be an unhandled rejection that the platform is now waiting for.
  const settled = Promise.resolve(promise).catch((e) => {
    console.error(`[background] ${label}: FAILED — ${e?.message || e}`);
  });
  try {
    waitUntil(settled);
  } catch {
    // No request context. Nothing to register with, nothing to do.
  }
  return settled;
}
