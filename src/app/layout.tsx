import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brand } from "@/config/brand";
import OldBrowserBanner from "@/components/ui/OldBrowserBanner";
import { t } from "@/i18n/uz";

export const metadata: Metadata = {
  title: `${brand.name} — ${t.meta.title}`,
  description: t.meta.description,
  applicationName: brand.name,
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brand.themeColor,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Kalam:wght@700&family=Nunito:wght@600;700;800;900&display=swap"
        />
      </head>
      <body>
        {children}
        <OldBrowserBanner />
      </body>
    </html>
  );
}
