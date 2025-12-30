import { redirect } from "next/navigation";

export default function InternalRoot() {
  redirect("/internal/overview");
}
