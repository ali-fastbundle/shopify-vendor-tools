import { existsSync } from "fs";

/*
 * The photo on /about is supplied by hand into public/. Which file exists is
 * decided here, at build time, because public/ is served by the CDN and is not
 * on a function's filesystem at request time. No file, no image, rather than a
 * broken one.
 */
const ABOUT_PHOTO = ["jpg", "jpeg", "png", "webp"]
  .map((ext) => `/ali-arabzadeh.${ext}`)
  .find((f) => existsSync(`./public${f}`)) || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { ABOUT_PHOTO },
  /*
   * Phosphor ships one barrel file re-exporting every icon. Without this, a
   * single `import { Star }` pulls the whole set into the dev graph and slows
   * every rebuild; with it, Next rewrites the import to the one icon's own
   * module. Production output is tree-shaken either way.
   */
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    /*
     * The share card reads its .ttf files at request time. Nothing imports them as
     * modules, so tracing would not find them on its own and the card would quietly
     * fall back to a default face once deployed. Under `experimental` in
     * Next 14: at the top level it was rejected as an unknown key and ignored.
     */
    outputFileTracingIncludes: {
      "/og": ["./app/_fonts/**"],
      /* The idea review reads the project rules at request time (lib/ideaReview.js). */
      "/api/admin/ideas": ["./CLAUDE.md"],
    },
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    }];
  },
};
export default nextConfig;
