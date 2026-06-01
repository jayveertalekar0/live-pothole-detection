import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";   // <-- New

export const metadata: Metadata = {
  title: "Pothole Detection System",
  description: "AI‑powered road damage analysis & monitoring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden bg-slate-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}