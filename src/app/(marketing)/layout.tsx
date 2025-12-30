import type { ReactNode } from "react";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import LeadFormRoot from "@/components/marketing/lead/LeadFormRoot";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LeadFormRoot>
        <div>
          <Navbar />
          {children}
          <Footer />
        </div>
      </LeadFormRoot>
    </ThemeProvider>
  );
}
