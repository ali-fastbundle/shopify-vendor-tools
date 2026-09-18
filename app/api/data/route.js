import { read, KEYS } from "@/lib/store";

export const dynamic = "force-dynamic";

/*
 * A suggestion carries the submitter's address, and `also` carries the
 * addresses of everyone who asked for the same thing after them. Neither is
 * public, so both come off here before anything is served.
 */
const publicSuggestion = ({ email, also, ...rest }) => rest;

export async function GET() {
  const [votes, reviews, suggestions] = await Promise.all([
    read(KEYS.votes, {}),
    read(KEYS.reviews, {}),
    read(KEYS.suggestions, []),
  ]);
  const visible = (suggestions || []).filter((s) => s.approved !== false).map(publicSuggestion);
  return Response.json({ votes, reviews, suggestions: visible });
}
