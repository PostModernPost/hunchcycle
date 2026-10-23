import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  // already logged in: log out first to switch between owner and coach
  if (await getRole()) redirect("/");
  return (
    <div className="mx-auto mt-24 max-w-sm rounded-lg border border-line bg-surface p-6">
      <h1 className="mb-1 text-xl font-semibold">
        Hunch<span className="text-accent">cycle</span>
      </h1>
      <p className="mb-5 text-sm text-muted">Pick who you are, then enter the password.</p>
      <LoginForm />
    </div>
  );
}
