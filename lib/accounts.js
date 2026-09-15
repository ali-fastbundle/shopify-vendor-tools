/*
 * Account records. Deliberately three fields.
 *
 * Signing in proves control of an email address, and that address is already
 * the whole basis of a claim — so keeping it, with when it was first and last
 * used, costs nothing extra in exposure and makes the claim trail legible. What
 * is NOT kept is everything a directory has no business holding: no IP, no user
 * agent, no page history, no referrer, no session log. If you add a field here,
 * the sign-in copy in components/Account.jsx has to change to match it, because
 * that copy is a promise.
 */
import { read, write, KEYS } from "./store";

export async function getAccounts() {
  return read(KEYS.accounts, {});
}

/** Upsert on sign-in. First sight is preserved; last sight moves. */
export async function recordSignIn(email) {
  const accounts = await getAccounts();
  const now = new Date().toISOString();
  const existing = accounts[email];
  accounts[email] = {
    email,
    firstSeen: existing?.firstSeen || now,
    lastSeen: now,
  };
  await write(KEYS.accounts, accounts);
  // isNew drives the welcome mail: a first sign-in is news, a return is not.
  return { account: accounts[email], isNew: !existing };
}
