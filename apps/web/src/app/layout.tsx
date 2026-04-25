import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Molecule Agent Proxy",
  description:
    "Identity-gated, key-free API access for AI agents. Per-call nano-payments in USDC on Arc.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
