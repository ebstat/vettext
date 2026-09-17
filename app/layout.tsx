import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";

import { formatDatumTijdspanne } from "@/lib/datum";
import { haalGesprekkenLijstOp } from "@/lib/gesprekken";

import Sidebar from "./sidebar";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "VetText",
  description: "Transcripties van klantgesprekken",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const gesprekkenLijst = await haalGesprekkenLijstOp();

  const sidebarGesprekken = gesprekkenLijst.map((gesprek) => ({
    id: gesprek.id,
    tijdspanne: formatDatumTijdspanne(gesprek.gestartOp, gesprek.beeindigdOp),
    klantnaam: gesprek.klantnaam,
    preview: gesprek.preview,
    status: gesprek.status,
    foutmelding: gesprek.foutmelding,
  }));

  return (
    <html lang="nl" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <div className="layout">
          <Sidebar gesprekken={sidebarGesprekken} />
          <div className="inhoud">{children}</div>
        </div>
      </body>
    </html>
  );
}
