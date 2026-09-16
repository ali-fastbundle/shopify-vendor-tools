/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * Phosphor ships one barrel file re-exporting every icon. Without this, a
   * single `import { Star }` pulls the whole set into the dev graph and slows
   * every rebuild; with it, Next rewrites the import to the one icon's own
   * module. Production output is tree-shaken either way.
   */
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  /*
   * The share card reads its .ttf files at request time. Nothing imports them as
   * modules, so tracing would not find them on its own and the card would quietly
   * fall back to a default face once deployed.
   */
  outputFileTracingIncludes: {
    "/og": ["./app/_fonts/**"],
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
