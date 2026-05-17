import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import Nav from "./components/Nav";
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
          </div>
        </header>
        <Nav />
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
