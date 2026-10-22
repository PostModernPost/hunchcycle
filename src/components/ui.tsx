import Link from "next/link";

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className || "bg-stone-100 text-stone-700"}`}>
      {children}
    </span>
  );
}

export function Card({ children, href, className = "" }: { children: React.ReactNode; href?: string; className?: string }) {
  const cls = `block rounded-lg border border-line bg-white p-4 ${href ? "hover:border-stone-400" : ""} ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="mb-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-sm">{value}</div>
    </div>
  );
}

export function SeedFlag({ tags }: { tags: string[] }) {
  return tags.includes("seeded, review me") ? <Pill className="bg-violet-100 text-violet-800">seeded, review me</Pill> : null;
}
