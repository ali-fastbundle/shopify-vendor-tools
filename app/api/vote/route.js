import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { TOOLS } from "@/lib/tools";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const ip = ipOf(request);
  if (!(await allow("vote", ip, 60, 60_000))) {
    return new Response("Too many votes. Slow down.", { status: 429 });
  }
  const { id, previous, next } = await request.json();
  if (!TOOLS.some((t) => t.id === id)) return new Response("Unknown tool", { status: 400 });
  if (![-1, 0, 1].includes(previous) || ![-1, 0, 1].includes(next)) {
    return new Response("Bad vote", { status: 400 });
  }

  const votes = await read(KEYS.votes, {});
  const cur = votes[id] || { up: 0, down: 0 };
  if (previous === 1) cur.up = Math.max(0, cur.up - 1);
  if (previous === -1) cur.down = Math.max(0, cur.down - 1);
  if (next === 1) cur.up += 1;
  if (next === -1) cur.down += 1;
  votes[id] = cur;
  await write(KEYS.votes, votes);
  return Response.json({ votes });
}
