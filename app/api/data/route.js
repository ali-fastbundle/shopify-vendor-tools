import { read, KEYS } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [votes, reviews, suggestions] = await Promise.all([
    read(KEYS.votes, {}),
    read(KEYS.reviews, {}),
    read(KEYS.suggestions, []),
  ]);
  const visible = (suggestions || []).filter((s) => s.approved !== false);
  return Response.json({ votes, reviews, suggestions: visible });
}
