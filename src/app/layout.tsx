import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge — Your AI WebApp Builder",
  description:
    "Your own Cursor-level AI coding platform. Describe an app, get working code, iterate in a live workspace. Built for the 2026 stack.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080b13] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
