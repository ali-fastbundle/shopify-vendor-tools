/*
 * Inter for the share cards, read off disk. Shared by /og and /og/event/[id],
 * because a route file may export nothing but its handlers. Why a vendored
 * TTF and not next/font or a fetch: see app/og/route.js.
 */
import { readFile } from "fs/promises";
import { join } from "path";

const FACES = [
  { weight: 800, file: "Inter-800.ttf" },
  { weight: 500, file: "Inter-500.ttf" },
];

export async function inter() {
  try {
    return await Promise.all(
      FACES.map(async ({ weight, file }) => ({
        name: "Inter",
        data: await readFile(join(process.cwd(), "app", "_fonts", file)),
        weight,
        style: "normal",
      })),
    );
  } catch {
    // Falls back to next/og's bundled face. A share image is not worth failing a
    // build over, but the card will look wrong, so check here first if it does.
    return [];
  }
}

