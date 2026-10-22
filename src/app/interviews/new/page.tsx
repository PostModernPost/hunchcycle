import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { InterviewForm } from "@/components/interviews/InterviewForm";
import { blankInterview, loadInterviewLists } from "@/lib/interview-data";

export const dynamic = "force-dynamic";

export default async function NewInterview({ searchParams }: { searchParams: Promise<{ session?: string; person?: string }> }) {
  const { session, person } = await searchParams;
  const lists = await loadInterviewLists();
  const validPerson = lists.people.some((p) => p.id === person) ? person! : "";
  const validSession = lists.sessions.some((r) => r.id === session) ? session! : "";
  return (
    <div className="max-w-3xl">
      <Link href={validPerson ? `/people/${validPerson}` : "/people"} className="text-sm text-muted hover:text-ink">
        ← {validPerson ? "Back to the person" : "People"}
      </Link>
      <PageTitle title="New interview" sub="Pick the person and session, then fill in what you can. You can come back and add more later." />
      <InterviewForm initial={blankInterview({ personId: validPerson, runId: validSession })} {...lists} />
    </div>
  );
}
