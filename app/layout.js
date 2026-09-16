import { Inter } from "next/font/google";
import { TOOLS, LAST_UPDATED_ISO, HEADLINE, DARK } from "@/lib/tools";
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

const title = "The app vendor's toolkit — watchfor.tools";
const description =
  "Every tool built specifically for the people who build Shopify apps. Rankings, store data, revenue analytics, partner programs. Open directory, community rated.";

/*
 * Messengers and social platforms cache an OG image against its URL and hold it
 * for a long time, so a changed image behind an unchanged URL is one nobody
 * sees. Next appends a hash of the route's own output, which does not move when
 * only the catalogue changes — the image is generated from data, not from the
 * file. This version does move: a tool added or an entry edited changes it, and
 * scrapers refetch.
 */
const ogVersion = `${TOOLS.length}-${LAST_UPDATED_ISO}`;
const ogImage = {
  url: `/og?v=${ogVersion}`,
  width: 1200,
  height: 630,
  alt: `Watch For Tools — ${HEADLINE}`,
};

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
    images: [ogImage],
  },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
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
