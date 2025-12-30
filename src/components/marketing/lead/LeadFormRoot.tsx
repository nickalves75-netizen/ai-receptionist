"use client";

import type { ReactNode } from "react";
import LeadFormProvider from "@/components/marketing/lead/LeadFormProvider";

export default function LeadFormRoot({ children }: { children: ReactNode }) {
  return <LeadFormProvider>{children}</LeadFormProvider>;
}
