import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Appota Knowledge Copilot",
  description: "Trợ lý tra cứu chính sách và tri thức nội bộ Appota",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full dark">
      <body className="h-full overflow-hidden bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
