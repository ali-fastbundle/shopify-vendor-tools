import { normaliseEmail } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { followable, removeFollow, validStopToken } from "@/lib/follows";
import { noticePage } from "@/lib/notice";

export const dynamic = "force-dynamic";

/*
 * The stop link in every digest. With `id`, stops that one item; without, stops
 * everything. The token is an HMAC over the address and the item, so a link
 * cannot be edited to stop somebody else's, or to widen one item into all of
 * them. The page is the same whether or not anything was followed (invariant
 * 8). A GET, because it is clicked from an email.
 */
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const email = normaliseEmail(params.get("email"));
  const id = String(params.get("id") || "");
  if (!email || !validStopToken(email, id, params.get("token"))) {
    return noticePage("That link is not valid",
      "It may have been trimmed by your email client. Copy the whole link from the message, or reply to the email and it will be done by hand.",
      { status: 400 });
  }
  if (!(await allow("follow-remove", ipOf(request), 30, 60 * 60_000))) {
    return noticePage("Too many at once", "Try the link again in a few minutes.", { status: 429 });
  }
  await removeFollow(email, id);
  const item = id && followable(id);
  return item
    ? noticePage(`No more updates about ${item.name}`, "Anything else you follow is unchanged.")
    : noticePage("No more updates", "You are not following anything on the directory now. Nothing more will be sent.");
}
