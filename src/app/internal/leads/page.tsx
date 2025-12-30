import { redirect } from "next/navigation";

export default function InternalLeadsRedirect() {
  redirect("/internal/pipeline?view=list");
}
