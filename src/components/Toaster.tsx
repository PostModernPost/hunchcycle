"use client";
// App-wide error messages for server actions (see useAction in components/board/fields.tsx).
import { useCallback, useEffect, useState } from "react";
import { ToastContext } from "@/components/board/fields";

export function Toaster({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useCallback((m: string) => setMsg(m), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 7000);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      {msg && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-lg border border-line bg-raised px-4 py-3 text-sm shadow-lg">
          {msg}
          <button className="ml-3 text-muted hover:text-ink" onClick={() => setMsg(null)}>
            Dismiss
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
