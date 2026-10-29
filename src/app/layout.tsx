import type { Metadata } from "next";
import "./globals.css";
import "@/features/auth/auth.css";

export const metadata: Metadata = {
  title: "Nossa História",
  description: "Um espaço para guardar a nossa história.",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
