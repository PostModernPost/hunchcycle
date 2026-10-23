import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Toaster } from "@/components/Toaster";
import { RoleProvider } from "@/components/Role";
import { getRole } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "Hunchcycle",
  description: "Turn hunches into evidence.",
};

const nav = [
  { href: "/", label: "Board" },
  { href: "/briefs", label: "Weekly brief" },
  { href: "/assumptions", label: "Assumptions" },
  { href: "/sessions", label: "Sessions" },
  { href: "/people", label: "People" },
  { href: "/scripts", label: "Scripts" },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const role = await getRole();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {role ? (
          <>
            <header className="border-b border-line bg-white">
              <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
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
                <form action={logout} className="ml-auto flex items-center gap-3 text-sm text-muted">
                  <span>{role === "owner" ? "Owner" : "Coach (read and comment)"}</span>
                  <button type="submit" className="hover:text-ink">
                    Log out
                  </button>
                </form>
              </div>
            </header>
            <main className="mx-auto max-w-[1800px] px-4 py-6">
              <RoleProvider role={role}>
                <Toaster>{children}</Toaster>
              </RoleProvider>
            </main>
          </>
        ) : (
          <main className="px-4">{children}</main>
        )}
      </body>
    </html>
  );
}
