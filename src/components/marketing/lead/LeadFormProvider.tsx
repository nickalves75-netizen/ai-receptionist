"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import LeadFormModal from "./LeadFormModal";

type LeadFormContextValue = {
  openLeadForm: (source?: string) => void;
  closeLeadForm: () => void;
};

const LeadFormContext = createContext<LeadFormContextValue | null>(null);

export function useLeadForm() {
  const ctx = useContext(LeadFormContext);
  if (!ctx) throw new Error("useLeadForm must be used within LeadFormProvider");
  return ctx;
}

export function LeadFormProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>("unknown");

  const openLeadForm = useCallback((s?: string) => {
    setSource(s || "unknown");
    setOpen(true);
  }, []);

  const closeLeadForm = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openLeadForm, closeLeadForm }), [openLeadForm, closeLeadForm]);

  return (
    <LeadFormContext.Provider value={value}>
      {children}
      <LeadFormModal open={open} onClose={closeLeadForm} source={source} />
    </LeadFormContext.Provider>
  );
}

export default LeadFormProvider;
