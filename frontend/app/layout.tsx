import type { Metadata } from "next";
import Script from "next/script";
import { AppProviders } from "@/components/AppProviders";
import { Crimson_Text, Inter } from "next/font/google";
import "./globals.css";

const THEME_INIT = `(function(){try{var k="audiobook-theme";var m=localStorage.getItem(k);var r=document.documentElement;if(m==="light")r.classList.remove("dark");else if(m==="dark")r.classList.add("dark");else{if(window.matchMedia("(prefers-color-scheme: dark)").matches)r.classList.add("dark");else r.classList.remove("dark");}}catch(e){}})();`;

const crimson = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shelf Audio - Book to Audiobook",
  description:
    "Turn any PDF into a warm, listenable audiobook with natural AI voices.",
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${crimson.variable}`} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <Script id="audiobook-theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
