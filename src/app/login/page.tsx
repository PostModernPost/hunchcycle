import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-24 max-w-sm rounded-lg border border-line bg-surface p-6">
      <h1 className="mb-1 text-xl font-semibold">
        Hunch<span className="text-accent">cycle</span>
      </h1>
      <p className="mb-5 text-sm text-muted">Enter the owner or coach password.</p>
      <LoginForm />
    </div>
  );
}
