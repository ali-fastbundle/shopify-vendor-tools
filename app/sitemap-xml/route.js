import sitemap from "../sitemap";
import { resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";
import { text } from "@/lib/cdnCache";

export const dynamic = "force-dynamic";

/*
 * /sitemap.xml, served with a cache header.
 *
 * app/sitemap.js stays the one definition of what is in the sitemap. Next's
 * own route for it answers "max-age=0, must-revalidate", which the CDN never
 * keeps, so every crawler fetch rebuilt the whole list from the store. A
 * beforeFiles rewrite in next.config.mjs sends /sitemap.xml here instead, and
 * this serialises the same entries with Next's own serialiser and an s-maxage.
 */
export async function GET() {
  return new Response(resolveSitemap(await sitemap()), {
    headers: { "content-type": "application/xml", "cache-control": text(3600) },
  });
}
