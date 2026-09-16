/** @type {import('next').NextConfig} */
const nextConfig = {
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
