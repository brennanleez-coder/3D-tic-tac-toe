import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuadCube | 3D Tic Tac Toe - 4×4×4 Cube Challenge",
  description: "Play QuadCube - an interactive 3D tic tac toe game with a 4×4×4 grid. Rotate, pan, zoom and compete for 4 in a row across any dimension! Experience the classic game in stunning three-dimensional space.",
  keywords: [
    "QuadCube",
    "3D tic tac toe",
    "3D tic-tac-toe",
    "three dimensional tic tac toe",
    "3D tictactoe",
    "3D tic tac toe game",
    "4x4x4 tic tac toe",
    "3D game",
    "puzzle",
    "strategy",
    "two-player",
    "4x4x4",
    "three dimensional game",
    "3D board game",
    "interactive 3D",
    "web game",
    "browser game",
  ],
  openGraph: {
    title: "QuadCube | 3D Tic Tac Toe - 4×4×4 Cube Challenge",
    description: "Play QuadCube - an interactive 3D tic tac toe game with a 4×4×4 grid. Rotate, pan, zoom and compete for 4 in a row across any dimension!",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuadCube | 3D Tic Tac Toe - 4×4×4 Cube Challenge",
    description: "Play QuadCube - an interactive 3D tic tac toe game with a 4×4×4 grid. Experience the classic game in stunning three-dimensional space.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
