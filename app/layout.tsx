import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-brand",
  weight: ["600", "700", "800"],
  display: "swap",
});
// Tipografía del prototipo aprobado (docs/prototype)
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "https://ventory-ten.vercel.app"),
  title: "Ventory — Sistema POS",
  description: "Punto de venta para pequeñas y medianas empresas",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Ventory" },
  // Cómo se ve el enlace al compartirlo (WhatsApp, redes) y en buscadores
  openGraph: {
    type: "website",
    siteName: "Ventory",
    title: "Ventory — Punto de venta e inventario para tu negocio",
    description:
      "Vende, controla tu inventario y cuadra la caja desde cualquier dispositivo. Funciona sin internet. Prueba gratis 15 días.",
    locale: "es_CO",
    images: [{ url: "/brand/ventory-logo.png", width: 1155, height: 294, alt: "Ventory" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#6366F1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jakartaSans.variable} ${poppins.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
