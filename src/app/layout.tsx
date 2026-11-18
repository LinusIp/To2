import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brand } from "@/config/brand";
import OldBrowserBanner from "@/components/ui/OldBrowserBanner";
import A11yRoot from "@/components/a11y/A11yRoot";
import { t } from "@/i18n/uz";

export const metadata: Metadata = {
  title: `${brand.name} — ${t.meta.title}`,
  description: t.meta.description,
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
        <A11yRoot />
      </body>
    </html>
  );
}
