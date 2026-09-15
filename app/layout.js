import "./globals.css";

const title = "The app vendor's toolkit — watchfor.tools";
const description =
  "Every tool built specifically for the people who build Shopify apps. Rankings, store data, revenue analytics, partner programs. Open directory, community rated.";

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

export const viewport = { themeColor: "#06110D" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
