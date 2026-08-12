import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LenisProvider } from "@/components/os/lenis-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SKYNET // AI LAB OS",
  description:
    "Skynet’s AI lab, built as an operating system — a research log, live builds, system architecture and a working terminal.",
  applicationName: "SKYNET // AI LAB OS",
  keywords: ["Skynet", "AI", "machine learning", "AI agents", "portfolio"],
  openGraph: {
    title: "SKYNET // AI LAB OS",
    description: "An AI/ML student’s portfolio, built as an operating system.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060608",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
