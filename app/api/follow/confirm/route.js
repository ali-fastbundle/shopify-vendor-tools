import { readFollowToken } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { followable, addFollow } from "@/lib/follows";
import { noticePage } from "@/lib/notice";

export const dynamic = "force-dynamic";

/*
 * The second half of the double opt-in. The link carries the address and the
 * item, signed, so this is where an address is first written. Idempotent:
 * clicking twice, or confirming something already followed, lands on the same
 * page. The token check is pure, so the limiter sits after it (invariant 6).
 */
export async function GET(request) {
  const claims = readFollowToken(new URL(request.url).searchParams.get("token"));
  const item = claims && followable(claims.id);
  if (!claims || !item) {
    return noticePage("That link has expired",
      "Confirmation links last a week. Ask for updates again from the listing and a fresh one will arrive.", { status: 400 });
  }
  if (!(await allow("follow-confirm", ipOf(request), 30, 60 * 60_000))) {
    return noticePage("Too many at once", "Try the link again in a few minutes.", { status: 429 });
  }
  await addFollow(claims.email, item.id);
  return noticePage(`You are following ${item.name}`,
    "Anything that happens arrives in one email a day with everything else you follow, and only on a day something did. Every email has a link to stop.",
    { link: { label: `Back to ${item.name}`, href: item.path } });
}
