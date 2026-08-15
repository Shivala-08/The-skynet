import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LenisProvider } from "@/components/os/lenis-provider";
import { PrintResume } from "@/components/print-resume";
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
  metadataBase: new URL("https://the-skynet.vercel.app"),
  title: "SKYNET // AI LAB OS",
  description:
    "Skynet’s AI lab, built as an operating system — a research log, live builds, system architecture and a working terminal.",
  applicationName: "SKYNET // AI LAB OS",
  keywords: ["Skynet", "AI", "machine learning", "AI agents", "portfolio", "Pallav Dholariya", "Creative Frontend", "WebGL"],
  authors: [{ name: "Pallav Dholariya", url: "https://github.com/Shivala-08" }],
  creator: "Pallav Dholariya",
  publisher: "Pallav Dholariya",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "SKYNET // AI LAB OS",
    description: "An AI/ML student’s portfolio, built as an operating system.",
    type: "website",
    siteName: "SKYNET // AI LAB OS",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 675,
        alt: "SKYNET // AI LAB OS Terminal Interface",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SKYNET // AI LAB OS",
    description: "An AI/ML student’s portfolio, built as an operating system.",
    images: ["/og-image.jpg"],
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
        {/* Film grain overlay — kills the flat-digital look without a texture asset */}
        <div aria-hidden="true" className="film-grain pointer-events-none fixed inset-0 z-[200]" />
        <LenisProvider>{children}</LenisProvider>
        {/* Hidden on screen; becomes the entire page when printing. */}
        <PrintResume />
      </body>
    </html>
  );
}
