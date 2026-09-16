import { TOOLS, LAST_UPDATED_ISO, HEADLINE } from "@/lib/tools";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

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

export const viewport = { themeColor: "#06110D" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
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
