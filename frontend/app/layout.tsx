import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import Nav from "./components/Nav";
import UserSetup from "./components/UserSetup";
import AutoSetup from "./components/AutoSetup";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Trading Signal Desk",
  description: "Rule-based scanner with AI signal summaries. User-confirmed execution only.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* Site header */}
        <header className="border-b border-line" style={{ background: "linear-gradient(135deg, #F9F8F3 0%, #F2F1EB 100%)" }}>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-ink text-[11px] font-bold text-white shadow-sm">
                T
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-ink leading-tight">
                  Trading Signal Desk
                </h1>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                  AI assisted · User confirmed
                </p>
              </div>
            </div>
            <UserSetup />
          </div>
        </header>
        <Nav />
        <Suspense><AutoSetup /></Suspense>
        <div className="animate-fadein">{children}</div>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
