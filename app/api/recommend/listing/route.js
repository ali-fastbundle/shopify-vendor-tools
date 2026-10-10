import { sessionFrom } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { listingHandle, listingUrl, readListing } from "@/lib/appListing";

export const dynamic = "force-dynamic";

/*
 * Read one App Store listing so the flow can show what was found before
 * asking anything else: name, category, rating, reviews, launch date. Same
 * rules as the run (lib/appListing.js): the listing page only, never search
 * or reviews. Signed in, and limited after the session check, because this is
 * a fetch on somebody's behalf.
 */
export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in to read a listing.", { status: 401 });
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const handle = listingHandle(body.url);
  if (!handle) return new Response("That is not an App Store listing. It looks like https://apps.shopify.com/your-app.", { status: 400 });
  if (!(await allow("reclisting", ipOf(request), 30, 60 * 60_000))) {
    return new Response("That is a lot of listings in an hour. Try again later.", { status: 429 });
  }
  try {
    const app = await readListing(handle);
    return Response.json({ handle, url: listingUrl(handle), app });
  } catch (e) {
    const reason = /not found/.test(e.message) ? "There is no listing at that address." : "The listing could not be read just now.";
    return Response.json({ handle, url: listingUrl(handle), app: null, reason });
  }
}
