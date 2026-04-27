import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "家計簿 Kakebo Pro",
  description: "Controle Financeiro Pessoal",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#7c6af7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-bg min-h-screen">{children}</body>
    </html>
  );
}
