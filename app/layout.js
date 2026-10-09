import { Inter } from "next/font/google";
import { HEADLINE, DARK } from "@/lib/tools";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeScript } from "@/components/Theme";
import "./globals.css";

/*
 * Inter, the typeface the Shopify admin uses — which is most of what makes a
 * tool aimed at people who live in that admin feel like it belongs, without
 * borrowing anything of Shopify's that is theirs to lend.
 *
 * next/font fetches it at build and serves it from our own origin, so there is
 * no request to Google from a visitor's browser and no layout shift while a
 * webfont arrives. The family is named once, here, and handed to globals.css
 * as --font-sans; components say fontFamily: "inherit" and never a family.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const title = "The app vendor's toolkit | watchfor.tools";
const description =
  "Every tool built for the people who build Shopify apps, and the few general ones worth leaving for. Rankings, store data, revenue analytics, partner programs. Open directory, community rated.";

/*
 * The share image is not set here. Its URL carries a version derived from what
 * the card draws (lib/ogCard.js), which includes entries published from Redis,
 * so it can only be known per request, and this layout's metadata is static.
 * The homepage, which is dynamic anyway, sets it in generateMetadata. A static
 * version here is what went stale: it counted the file alone.
 */

export const metadata = {
  metadataBase: new URL("https://watchfor.tools"),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    type: "website",
    url: "https://watchfor.tools",
    siteName: "watchfor.tools",
  },
  twitter: { card: "summary_large_image", title, description },
};

/*
 * Dark, matching the page a visitor with no JavaScript gets. The theme script
 * rewrites this tag's content the moment it resolves a theme, which is why it
 * is one colour here and not a pair of prefers-color-scheme variants: those
 * follow the system and would keep painting a dark bar above a light page for
 * anyone who chose light with the toggle.
 */
export const viewport = { themeColor: DARK.bg };

export default function RootLayout({ children }) {
  return (
    /*
     * suppressHydrationWarning is for the one attribute ThemeScript sets on
     * this element before React ever runs. It covers the <html> tag itself and
     * nothing inside it, so a real mismatch further down still shows up.
     */
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        {/* First in the body, so the theme is resolved before anything paints. */}
        <ThemeScript />
        {children}
        {/*
          * Page traffic lives here, not in Redis. Views, referrers and paths are
          * what Vercel Analytics already does well and what this app has no
          * business reimplementing; svt:stats holds only the two things Vercel
          * cannot see — which tool was opened, and what the matcher was asked.
          */}
        <Analytics />
        {/* Core Web Vitals from real visits. Like Analytics, it injects nothing
          * during SSR and reports only on Vercel. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
