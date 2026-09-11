import "./globals.css";

const title = "The Shopify app vendor's toolkit";
const description =
  "Every tool built specifically for the people who build Shopify apps. Rankings, store data, revenue analytics, partner programs. Open directory, community rated.";

export const metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
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
