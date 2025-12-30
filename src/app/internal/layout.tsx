import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import InternalChrome from "./internal-chrome";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export default function InternalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={inter.className}
      style={{
        textRendering: "optimizeLegibility",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <InternalChrome>{children}</InternalChrome>
    </div>
  );
}