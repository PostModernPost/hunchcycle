import { redirect } from "next/navigation";

// Experiments are called sprints in the app now.
export default async function ExperimentRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/sprints/${id}`);
}
