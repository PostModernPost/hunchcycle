"use client";
// The board: columns from BRIEF section 4, drag and drop with gates, WIP warning, stale flag.
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { BoardCard } from "@/lib/board-data";
import { BOARD_STAGES, blockedMessage, checkMove, isStale, missingFor, toGateCard, type Stage } from "@/lib/gates";
import { fmtDate, STAGE_LABELS } from "@/lib/format";
import { Pill, SeedFlag } from "@/components/ui";
import { createCard, moveCard } from "@/app/actions";
import { Drawer, type Lists } from "./Drawer";
import { Button, inputCls, ToastContext, useAction } from "./fields";

const WIP_LIMIT = 3;

type Props = { cards: BoardCard[]; lists: Lists; initialOpen?: string };

export function Board(props: Props) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toast = useCallback((msg: string) => setToastMsg(msg), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 7000);
    return () => clearTimeout(t);
  }, [toastMsg]);
  return (
    <ToastContext.Provider value={toast}>
      <BoardInner {...props} />
      {toastMsg && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
          {toastMsg}
          <button className="ml-3 text-stone-400 hover:text-white" onClick={() => setToastMsg(null)}>
            Dismiss
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

function BoardInner({ cards, lists, initialOpen }: Props) {
  const toast = useContext(ToastContext);
  const { run } = useAction();
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  const [moved, setMoved] = useState<Record<string, Stage>>({}); // optimistic stage while a move saves
  const [dragId, setDragId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const now = useMemo(() => new Date(), []);

  // Keep the open card in the URL so a link or reload reopens it.
  const open = (id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("card", id);
    else url.searchParams.delete("card");
    window.history.replaceState(null, "", url);
  };

  const stageOf = (c: BoardCard) => moved[c.id] ?? c.stage;
  const q = query.trim().toLowerCase();
  const matches = (c: BoardCard) => !q || c.title.toLowerCase().includes(q);
  const closed = cards.filter((c) => stageOf(c) === "closed" && matches(c));
  const openCard = cards.find((c) => c.id === openId) ?? null;
  const dragCard = cards.find((c) => c.id === dragId) ?? null;

  // Check the gate before saving a drop, so a blocked card snaps back with a reason.
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const card = cards.find((c) => c.id === e.active.id);
    const to = e.over?.id as Stage | undefined;
    if (!card || !to || to === stageOf(card)) return;
    const check = checkMove(toGateCard({ ...card, stage: stageOf(card) }), to);
    if (!check.ok) return toast(blockedMessage(check));
    setMoved((m) => ({ ...m, [card.id]: to }));
    run(
      () => moveCard(card.id, to),
      () =>
        setMoved((m) => {
          const rest = { ...m };
          delete rest[card.id];
          return rest;
        }),
    );
  };

  return (
    <>
      {/* A fixed id keeps dnd-kit's generated ids the same on the server and in the browser. */}
      <DndContext id="board" sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={onDragEnd}>
        <Toolbar query={query} setQuery={setQuery} onCreated={open} />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4">
          {BOARD_STAGES.map((stage) => {
            const col = cards
              .filter((c) => stageOf(c) === stage && matches(c))
              .sort((a, b) => Number(isStale(b, now)) - Number(isStale(a, now)));
            return (
              <Column key={stage} stage={stage} count={col.length}>
                {col.map((c) => (
                  <DraggableCard key={c.id} card={{ ...c, stage }} now={now} onOpen={() => open(c.id)} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{dragCard && <CardFace card={dragCard} now={now} lifted />}</DragOverlay>
      </DndContext>

      <div className="mt-4">
        <button className="text-sm text-muted hover:text-ink" onClick={() => setShowClosed(!showClosed)}>
          {showClosed ? "Hide" : "Show"} closed cards ({closed.length})
        </button>
        {showClosed && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {closed.map((c) => (
              <button key={c.id} onClick={() => open(c.id)} className="rounded-lg border border-line bg-white p-3 text-left hover:border-stone-400">
                <div className="text-sm font-medium">{c.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {c.decision && <Pill>{c.decision}</Pill>}
                  {c.closedAt && <span className="text-xs text-muted">closed {fmtDate(c.closedAt)}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {openCard && (
        <Drawer
          key={openCard.id}
          card={openCard}
          lists={lists}
          siblings={cards.filter((c) => c.siblingGroup && c.siblingGroup === openCard.siblingGroup && c.id !== openCard.id)}
          onClose={() => open(null)}
          onOpen={open}
        />
      )}
    </>
  );
}

function Toolbar({ query, setQuery, onCreated }: { query: string; setQuery: (q: string) => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createCard(title),
            (r) => {
              if (r.ok && r.id) {
                setTitle("");
                onCreated(r.id);
              }
            },
          );
        }}
      >
        <input className={`${inputCls} w-64`} placeholder="New experiment title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" kind="primary" disabled={pending || !title.trim()}>
          Add card
        </Button>
      </form>
      <input className={`${inputCls} ml-auto w-56`} placeholder="Search cards" value={query} onChange={(e) => setQuery(e.target.value)} />
    </div>
  );
}

function Column({ stage, count, children }: { stage: Stage; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const overWip = stage === "running" && count > WIP_LIMIT;
  return (
    <div ref={setNodeRef} className={`flex w-60 shrink-0 flex-col rounded-lg p-2 ${isOver ? "bg-stone-200" : "bg-stone-100"}`}>
      <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        <span>{STAGE_LABELS[stage]}</span>
        <span>{count}</span>
      </div>
      {overWip && (
        <div className="mb-2 rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
          {count} cards running. More than {WIP_LIMIT} at once makes it hard to learn from any of them.
        </div>
      )}
      <div className="min-h-24 flex-1 space-y-2">{children}</div>
    </div>
  );
}

function DraggableCard({ card, now, onOpen }: { card: BoardCard; now: Date; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onOpen} className={isDragging ? "opacity-30" : ""}>
      <CardFace card={card} now={now} />
    </div>
  );
}

function CardFace({ card: c, now, lifted }: { card: BoardCard; now: Date; lifted?: boolean }) {
  const stale = isStale(c, now);
  const missing = missingFor(c.stage, toGateCard(c)).length;
  return (
    <div className={`cursor-pointer rounded-md border bg-white p-3 ${stale ? "border-red-300" : "border-line"} ${lifted ? "rotate-1 shadow-lg" : "hover:border-stone-400"}`}>
      <div className="text-sm font-medium leading-snug">{c.title}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {stale && <Pill className="bg-red-100 text-red-800">past report date</Pill>}
        {c.siblingGroup && <Pill className="bg-sky-100 text-sky-800">split</Pill>}
        <SeedFlag tags={c.tags} />
      </div>
      <div className="mt-2 text-xs text-muted">
        {c.assumptions.length} assumption{c.assumptions.length === 1 ? "" : "s"}, {c.metrics.length} metric{c.metrics.length === 1 ? "" : "s"}, {c.runs.length} run
        {c.runs.length === 1 ? "" : "s"}
        {c.reportDate && <>. Report {fmtDate(c.reportDate)}</>}
      </div>
      <div className={`mt-1 text-xs ${missing ? "text-amber-700" : "text-green-700"}`}>
        {missing ? `${missing} thing${missing === 1 ? "" : "s"} to fill before moving on` : "Ready to move on"}
      </div>
    </div>
  );
}
