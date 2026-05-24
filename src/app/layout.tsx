import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ciśnieniomierz",
  description: "Aplikacja do monitorowania ciśnienia tętniczego",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
