import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PwaRegister } from "@/components/PwaRegister";
import {
  ThemeProvider,
  themeBootstrapScript,
} from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GRIEEZBOY AIO — Multi-Source Media Engine",
    template: "%s · GRIEEZBOY AIO",
  },
  description:
    "One engine, seven platforms. Paste a link from YouTube, TikTok, Instagram, Facebook, X, Pinterest or Threads and pull every available format.",
  applicationName: "GRIEEZBOY AIO",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GRIEEZBOY AIO",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-512.png", sizes: "512x512" }],
  },
  openGraph: {
    title: "GRIEEZBOY AIO — Multi-Source Media Engine",
    description: "ONE ENGINE → 7 PLATFORMS → PASTE URL → EXECUTE → DOWNLOAD",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07080a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap"
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:border focus:border-[var(--accent)] focus:bg-[var(--panel-solid)] focus:px-3 focus:py-2 focus:text-xs"
            >
              Skip to content
            </a>
            <Navbar />
            <main id="main" className="min-h-[60vh]">
              {children}
            </main>
            <Footer />
            <PwaRegister />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
