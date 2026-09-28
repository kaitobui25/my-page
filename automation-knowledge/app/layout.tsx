import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automation Knowledge Base",
  description:
    "A fast, searchable personal knowledge base for PLC, automation and field experience.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
