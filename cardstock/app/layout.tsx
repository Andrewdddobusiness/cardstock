import "./../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CardStock Sydney - Pokemon Card Stock Tracker",
  description: "Track Pokemon card stock across Kmart, BIG W, and EB Games in Sydney",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        {children}
      </body>
    </html>
  );
}