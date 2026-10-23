"use client";
// Comments on a sprint or a brief. Both logins can post; each comment records the role and a name.
import { useEffect, useState } from "react";
import { Button, useAction } from "@/components/board/fields";
import { inputCls } from "@/components/styles";
import { addComment } from "@/app/comments/actions";
import { fmtDate } from "@/lib/format";

type Comment = { id: string; role: string; authorName: string | null; body: string; createdAt: Date };
const NAME_KEY = "hunchcycle.commentName";

export function Comments({ comments, experimentId, briefId }: { comments: Comment[]; experimentId?: string; briefId?: string }) {
  const { run, pending } = useAction();
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  // remember the name on this device only, as a convenience
  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {}
  }, []);
  const rememberName = (n: string) => {
    setName(n);
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {}
  };

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Comments ({comments.length})</h3>
      <div className="space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border border-line bg-surface p-3 text-sm">
            <div className="text-xs text-muted">
              <span className="font-medium text-ink">{c.authorName || (c.role === "coach" ? "Coach" : "Owner")}</span>
              {c.authorName && `, ${c.role}`}, {fmtDate(c.createdAt)}
            </div>
            <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
          </div>
        ))}
      </div>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => addComment({ experimentId, briefId, authorName: name, body }),
            (r) => r.ok && setBody(""),
          );
        }}
      >
        <textarea className={inputCls} rows={2} placeholder="Add a comment" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="mt-2 flex items-center gap-2">
          <input className={`${inputCls.replace("w-full ", "")} w-48`} placeholder="Your name" value={name} onChange={(e) => rememberName(e.target.value)} />
          <Button type="submit" forCoach disabled={pending || !body.trim()}>
            Post comment
          </Button>
        </div>
      </form>
    </div>
  );
}
