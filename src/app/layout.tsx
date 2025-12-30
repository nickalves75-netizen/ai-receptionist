// src/app/layout.tsx
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kallr",
  description: "AI that works your phones — so your team doesn’t have to.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={space.className}
        style={{
          margin: 0,
          background: "#ffffff",
          color: "#181f2d",
        }}
      >
        <style>{`
          :root{
            /* Palette (your core identity) */
            --kallr-core: #147f6a;
            --kallr-accent: #1dbd88;

            /* Text + neutrals */
            --ink: #181f2d;
            --muted: rgba(24,31,45,0.72);
            --muted2: rgba(24,31,45,0.55);

            /* Surfaces */
            --border: rgba(24,31,45,0.10);
            --border2: rgba(24,31,45,0.14);
            --card: rgba(255,255,255,0.92);

            /* Shadows */
            --shadow-sm: 0 10px 30px rgba(24,31,45,0.08);
            --shadow-md: 0 18px 60px rgba(24,31,45,0.12);
            --shadow-green: 0 18px 60px rgba(20,127,106,0.18);

            /* Radii */
            --r-lg: 20px;
            --r-md: 16px;
            --r-sm: 14px;
          }

          * { box-sizing: border-box; }
          html, body { height: 100%; }
          a { text-decoration: none; color: inherit; }
          input, select, button { font-family: inherit; }

          /* Buttons (Apple-ish: clean, tactile, not loud) */
          .btn-primary{
            display:inline-flex; align-items:center; justify-content:center;
            padding: 12px 18px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 14px;
            color: #fff;
            background: linear-gradient(180deg, rgba(29,189,136,1), rgba(20,127,106,1));
            border: 1px solid rgba(20,127,106,0.22);
            box-shadow: var(--shadow-green);
            transition: transform 140ms ease, filter 140ms ease;
            cursor: pointer;
            white-space: nowrap;
          }
          .btn-primary:hover{ transform: translateY(-1px); filter: brightness(1.02); }
          .btn-primary:active{ transform: translateY(0); filter: brightness(0.99); }

          .btn-ghost{
            display:inline-flex; align-items:center; justify-content:center;
            padding: 12px 18px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 14px;
            color: var(--ink);
            background: rgba(255,255,255,0.80);
            border: 1px solid var(--border2);
            box-shadow: 0 10px 30px rgba(24,31,45,0.06);
            transition: transform 140ms ease, background 140ms ease;
            cursor: pointer;
            white-space: nowrap;
          }
          .btn-ghost:hover{ transform: translateY(-1px); background: rgba(255,255,255,0.92); }
          .btn-ghost:active{ transform: translateY(0); }

          /* Inputs */
          .field{
            width: 100%;
            height: 46px;
            padding: 0 14px;
            border-radius: 14px;
            border: 1px solid var(--border2);
            background: rgba(255,255,255,0.92);
            color: var(--ink);
            outline: none;
            box-shadow: 0 8px 22px rgba(24,31,45,0.04);
            transition: border-color 140ms ease, box-shadow 140ms ease;
            font-size: 14px;
            font-weight: 500;
          }
          .field::placeholder{ color: rgba(24,31,45,0.45); font-weight: 500; }
          .field:focus{
            border-color: rgba(29,189,136,0.55);
            box-shadow: 0 0 0 4px rgba(29,189,136,0.16), 0 14px 34px rgba(24,31,45,0.08);
          }

          .label{
            display:block;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
            color: rgba(24,31,45,0.70);
            margin-bottom: 8px;
          }
        `}</style>

        {children}
      </body>
    </html>
  );
}
