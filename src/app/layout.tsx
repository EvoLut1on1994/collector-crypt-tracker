import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Collector Crypt NFT 追踪工具",
  description: "查询 Solana 地址持有的 Collector Crypt NFT 与官方美元估值。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
