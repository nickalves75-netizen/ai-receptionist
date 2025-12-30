"use client";

import { useLeadForm } from "./LeadFormProvider";

export function LeadCtaButton({
  children,
  className,
  source,
}: {
  children: React.ReactNode;
  className?: string;
  source?: string;
}) {
  const { openLeadForm } = useLeadForm();

  return (
    <button className={className} type="button" onClick={() => openLeadForm(source)}>
      {children}
    </button>
  );
}
