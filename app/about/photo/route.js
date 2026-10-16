import { getAboutPhoto } from "@/lib/aboutStore";

export const dynamic = "force-dynamic";

/*
 * The /about photo uploaded from /admin (lib/aboutStore.js). The URL carries
 * a hash of the bytes, so a new photo is a new URL and this one can be cached
 * for a year. No upload means a 404, and the page uses the file in public/.
 */
export async function GET() {
  const p = await getAboutPhoto();
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(p.data, "base64"), {
    headers: {
      "Content-Type": p.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
