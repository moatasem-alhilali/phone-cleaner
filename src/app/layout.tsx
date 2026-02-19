import type { Metadata } from "next";
import { Cairo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "منظف أرقام الهاتف",
  description: "تنظيف وتوحيد الأرقام مع تقارير المكرر والغير صالح.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} ${plexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
