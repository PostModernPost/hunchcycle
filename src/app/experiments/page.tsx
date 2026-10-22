import { redirect } from "next/navigation";

// The board on the home page replaced this list; experiments are called sprints in the app now.
export default function ExperimentsPage() {
  redirect("/");
}
