import { redirect } from "next/navigation";

// Runs are called sessions in the app now.
export default function RunsPage() {
  redirect("/sessions");
}
