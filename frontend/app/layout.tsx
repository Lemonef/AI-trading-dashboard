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
        <header className="border-b border-line bg-[#F7F6F0]">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                AI assisted · User confirmed
              </p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-ink">
                Trading Signal Desk
              </h1>
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
