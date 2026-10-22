import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hunchcycle",
  description: "Turn hunches into evidence.",
};

const nav = [
  { href: "/experiments", label: "Experiments" },
  { href: "/assumptions", label: "Assumptions" },
  { href: "/runs", label: "Runs" },
  { href: "/people", label: "People" },
  { href: "/scripts", label: "Scripts" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Hunch<span className="text-accent">cycle</span>
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-muted">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
