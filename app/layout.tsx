import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DiguDogu - SNS & C2C Commerce",
  description:
    "Explore and trade with DiguDogu - your social networking and commerce platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        {/* Navigasi Global */}
        <Navigation />

        {/* Konten Utama */}
        <div className="md:ml-16 lg:ml-60 w-full md:w-[calc(100%-4rem)] lg:w-[calc(100%-15rem)] min-h-[100dvh]">
          {children}
        </div>
      </body>
    </html>
  );
}
