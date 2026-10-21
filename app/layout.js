import { Inter } from "next/font/google";
import { HEADLINE } from "@/lib/tools";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeScript } from "@/components/Theme";
import { SiteFrameProvider, SiteShell, SiteFooter } from "@/components/SiteFrame";
import { frameData } from "@/lib/frameData";
import { publishedListCount } from "@/lib/listsSection";
import { toolCounts } from "@/lib/toolCountStore";
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
/* The light canvas: with scripting off the page is light (globals.css), and
   the theme script replaces this with the resolved theme before first paint. */
export const viewport = { themeColor: "#F1F2F3" };

export default async function RootLayout({ children }) {
  /* The lists section opens in the nav only once it has a list worth showing
     (lib/listsSection.js): one cached store read, never a page's worth. */
  /* The public tool count, the one every surface states (lib/toolCount.js).
     Store down: frameData counts the file instead, through the same function. */
  let tools;
  try { tools = await toolCounts(); } catch { /* fall back inside frameData */ }
  const fd = frameData(tools);
  let lists = 0;
  try { lists = await publishedListCount(); } catch { /* store down: the section stays out of the nav */ }
  const frame = { ...fd, counts: { ...fd.counts, lists } };
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
        {/* One frame for every route (components/SiteFrame.jsx): the sidebar
            and the content column. Pages render their content and nothing
            around it. */}
        <SiteFrameProvider>
          <SiteShell {...frame}>
            {children}
            <SiteFooter />
          </SiteShell>
        </SiteFrameProvider>
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
