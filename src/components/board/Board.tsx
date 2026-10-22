"use client";
// The board: one row per active experiment. A row fills in left to right as the experiment moves
// through the chain (BRIEF section 4). Drag the current step into a later column to expand the row
// (gated), or into an earlier one to move it back. Click any step to open the drawer there.
// Finished experiments are listed separately underneath as slim lines.
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { BoardCard } from "@/lib/board-data";
import { BOARD_STAGES, blockedMessage, checkMove, filled, isStale, missingFor, toGateCard, type Stage } from "@/lib/gates";
import { experimentName, experimentSubtitle, fmtDate, STAGE_LABELS } from "@/lib/format";
import { Pill } from "@/components/ui";
import { createCard, createNextExperiment, moveCard } from "@/app/actions";
import { Drawer, type Lists } from "./Drawer";
import { Button, inputCls, ToastContext, useAction } from "./fields";
import { TypePicker, type ExperimentType } from "./TypePicker";

const WIP_LIMIT = 3;
const SEED_TAG = "seeded, review me";
const STAGE_INDEX = Object.fromEntries(BOARD_STAGES.map((s, i) => [s, i])) as Record<Stage, number>;
const GRID = { gridTemplateColumns: `250px repeat(${BOARD_STAGES.length}, 170px)` };
export const stageColor = (s: Stage) => `var(--color-stage-${s === "closed" ? "decision" : s})`;

type Props = { cards: BoardCard[]; lists: Lists; initialOpen?: string };
type Opener = (id: string | null, focus?: Stage) => void;

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
        <div role="alert" className="fixed bottom-4 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-lg border border-line bg-raised px-4 py-3 text-sm shadow-lg">
          {toastMsg}
          <button className="ml-3 text-muted hover:text-ink" onClick={() => setToastMsg(null)}>
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
  const [openState, setOpenState] = useState<{ id: string; focus?: Stage } | null>(initialOpen ? { id: initialOpen } : null);
  const [moved, setMoved] = useState<Record<string, Stage>>({}); // optimistic stage while a move saves
  const [dragId, setDragId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showFinished, setShowFinished] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const now = useMemo(() => new Date(), []);

  // Keep the open card in the URL so a link or reload reopens it.
  const open: Opener = (id, focus) => {
    setOpenState(id ? { id, focus } : null);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("card", id);
    else url.searchParams.delete("card");
    window.history.replaceState(null, "", url);
  };

  const q = query.trim().toLowerCase();
  const visible = cards
    .map((c) => ({ ...c, stage: moved[c.id] ?? c.stage }))
    .filter((c) => !q || `${experimentName(c)} ${c.title ?? ""}`.toLowerCase().includes(q));
  // past report date first, then furthest along
  const active = visible
    .filter((c) => c.stage !== "closed")
    .sort((a, b) => Number(isStale(b, now)) - Number(isStale(a, now)) || STAGE_INDEX[b.stage] - STAGE_INDEX[a.stage]);
  // most recently finished first
  const finished = visible
    .filter((c) => c.stage === "closed")
    .sort((a, b) => +new Date(b.closedAt ?? b.updatedAt) - +new Date(a.closedAt ?? a.updatedAt));
  const running = active.filter((c) => c.stage === "running").length;
  const toReview = cards.filter((c) => c.tags.includes(SEED_TAG)).length;
  const openCard = cards.find((c) => c.id === openState?.id) ?? null;
  const dragCard = visible.find((c) => c.id === dragId) ?? null;

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const card = visible.find((c) => c.id === e.active.id);
    const [rowId, to] = String(e.over?.id ?? "").split("|") as [string, Stage];
    if (!card || rowId !== card.id || !to || to === card.stage) return;
    const check = checkMove(toGateCard(card), to);
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
      <Toolbar query={query} setQuery={setQuery} onCreated={(id) => open(id)} types={lists.types} />
      {toReview > 0 && (
        <p className="mb-3 text-sm text-muted">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-violet-800" />
          {toReview} imported sprint{toReview === 1 ? " needs" : "s need"} a review. Open one and click &quot;Mark reviewed&quot; once it looks right.
        </p>
      )}
      {running > WIP_LIMIT && (
        <div className="mb-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {running} sprints are running. More than {WIP_LIMIT} at once makes it hard to learn from any of them.
        </div>
      )}

      {/* A fixed id keeps dnd-kit's generated ids the same on the server and in the browser. */}
      <DndContext id="board" sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={onDragEnd}>
        <div className="-mx-4 overflow-x-auto px-4 pb-4">
          <div className="grid min-w-max gap-y-2" style={GRID}>
            <HeaderRow />
            {active.length === 0 && <div className="col-span-full py-6 text-sm text-muted">No sprints match.</div>}
            {active.map((c) => (
              <Row key={c.id} card={c} now={now} dragging={dragId === c.id} onOpen={open} />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragCard && (
            <div className="rounded-md border px-3 py-2 text-xs font-medium shadow-lg" style={{ borderColor: stageColor(dragCard.stage), background: "var(--color-raised)" }}>
              Drag into a column to expand <span className="text-muted">{experimentName(dragCard)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="mt-4">
        <button className="text-sm text-muted hover:text-ink" onClick={() => setShowFinished(!showFinished)}>
          {showFinished ? "Hide" : "Show"} finished sprints ({finished.length})
        </button>
        {showFinished && (
          <div className="-mx-4 mt-2 overflow-x-auto px-4 pb-4">
            <div className="grid min-w-max gap-y-1.5" style={GRID}>
              {finished.map((c) => (
                <FinishedRow key={c.id} card={c} onOpen={open} />
              ))}
            </div>
          </div>
        )}
      </div>

      {openCard && (
        <Drawer
          key={openCard.id}
          card={openCard}
          focus={openState?.focus}
          lists={lists}
          siblings={cards.filter((c) => c.siblingGroup && c.siblingGroup === openCard.siblingGroup && c.id !== openCard.id)}
          onClose={() => open(null)}
          onOpen={open}
        />
      )}
    </>
  );
}

function Toolbar({
  query,
  setQuery,
  onCreated,
  types,
}: {
  query: string;
  setQuery: (q: string) => void;
  onCreated: (id: string) => void;
  types: ExperimentType[];
}) {
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createCard(typeId, title),
            (r) => {
              if (r.ok && r.id) {
                setTitle("");
                setTypeId("");
                onCreated(r.id);
              }
            },
          );
        }}
      >
        <TypePicker types={types} value={typeId} onPick={setTypeId} placeholder="Pick a type" className="w-48" />
        <input className={`${inputCls} w-56`} placeholder="Subtitle (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" kind="primary" disabled={pending || !typeId}>
          Add sprint
        </Button>
      </form>
      <input className={`${inputCls} ml-auto w-56`} placeholder="Search sprints" value={query} onChange={(e) => setQuery(e.target.value)} />
    </div>
  );
}

function HeaderRow() {
  return (
    <>
      <div className="sticky left-0 z-10 bg-paper pr-3 text-xs font-semibold uppercase tracking-wide text-muted">Sprint</div>
      {BOARD_STAGES.map((s) => (
        <div key={s} className="flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: stageColor(s) }} />
          {STAGE_LABELS[s]}
        </div>
      ))}
    </>
  );
}

function TitleCell({ card: c, now, onOpen, slim, children }: { card: BoardCard; now?: Date; onOpen: Opener; slim?: boolean; children?: React.ReactNode }) {
  const stale = now && isStale(c, now);
  return (
    <div className="sticky left-0 z-10 bg-paper pr-3">
      <div className={`h-full rounded-l-lg border-l-4 bg-surface ${slim ? "px-3 py-1.5" : "p-3"}`} style={{ borderLeftColor: stageColor(c.stage) }}>
        <button className="text-left text-sm font-semibold leading-snug hover:underline" onClick={() => onOpen(c.id)}>
          {experimentName(c)}
        </button>
        {experimentSubtitle(c) && <div className={`text-xs leading-snug text-muted ${slim ? "line-clamp-1" : ""}`}>{experimentSubtitle(c)}</div>}
        {(stale || c.siblingGroup) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {stale && <Pill className="bg-red-100 text-red-800">past report date</Pill>}
            {c.siblingGroup && <Pill className="bg-sky-100 text-sky-800">split</Pill>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Row({ card: c, now, dragging, onOpen }: { card: BoardCard; now: Date; dragging: boolean; onOpen: Opener }) {
  const current = STAGE_INDEX[c.stage];
  return (
    <>
      <TitleCell card={c} now={now} onOpen={onOpen} />
      {BOARD_STAGES.map((s, i) =>
        i < current ? (
          <DoneCell key={s} card={c} stage={s} first={i === 0} onOpen={onOpen} />
        ) : i === current ? (
          <CurrentCell key={s} card={c} first={i === 0} onOpen={onOpen} />
        ) : (
          <FutureCell key={s} card={c} stage={s} dragging={dragging} next={i === current + 1} />
        ),
      )}
    </>
  );
}

/** A finished experiment: one slim line with its decision and a way to start the next cycle. */
function FinishedRow({ card: c, onOpen }: { card: BoardCard; onOpen: Opener }) {
  const { run, pending } = useAction();
  return (
    <>
      <TitleCell card={c} onOpen={onOpen} slim />
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(c.id, "decision")}
        onKeyDown={(e) => e.key === "Enter" && onOpen(c.id, "decision")}
        className="flex cursor-pointer items-center gap-3 rounded-r-lg border border-line px-3 text-xs hover:brightness-125"
        style={{ gridColumn: `span ${BOARD_STAGES.length}`, background: "color-mix(in oklab, var(--color-stage-decision) 8%, var(--color-surface))" }}
      >
        <span className="text-muted">Finished {fmtDate(c.closedAt)}</span>
        {c.decision && <span className="font-semibold capitalize">{c.decision}</span>}
        {c.decisionNote && <span className="line-clamp-1 flex-1 text-muted">{c.decisionNote}</span>}
        <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <Button kind="quiet" disabled={pending} onClick={() => run(() => createNextExperiment(c.id), (r) => r.ok && r.id && onOpen(r.id))}>
            Start next sprint
          </Button>
        </span>
      </div>
    </>
  );
}

/** A filled step, tinted with its column's color. */
function StepBody({
  card,
  stage,
  first,
  last,
  onOpen,
  strong,
  children,
}: {
  card: BoardCard;
  stage: Stage;
  first?: boolean;
  last?: boolean;
  onOpen: Opener;
  strong?: boolean;
  children: React.ReactNode;
}) {
  const color = stageColor(stage);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(card.id, stage)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(card.id, stage)}
      className={`h-full cursor-pointer border-y border-r border-line p-3 text-xs leading-relaxed hover:brightness-125 ${first ? "border-l" : ""} ${last ? "rounded-r-lg" : ""}`}
      style={{
        background: `color-mix(in oklab, ${color} ${strong ? 26 : 12}%, var(--color-surface))`,
        borderTopColor: strong ? color : undefined,
        borderTopWidth: strong ? 2 : undefined,
      }}
    >
      {children}
    </div>
  );
}

function DoneCell({ card, stage, first, onOpen }: { card: BoardCard; stage: Stage; first: boolean; onOpen: Opener }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${card.id}|${stage}` });
  return (
    <div ref={setNodeRef} className={isOver ? "outline outline-2 -outline-offset-2 outline-stone-400" : ""}>
      <StepBody card={card} stage={stage} first={first} onOpen={onOpen}>
        <p className="line-clamp-2 text-muted">{fact(card, stage)}</p>
      </StepBody>
    </div>
  );
}

/** The step the experiment is on now: the only one with detail, and the one you drag. */
function CurrentCell({ card, first, onOpen }: { card: BoardCard; first: boolean; onOpen: Opener }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  const missing = missingFor(card.stage, toGateCard(card));
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`h-full ${isDragging ? "opacity-50" : ""}`} title="Click to open. Drag right to expand.">
      <StepBody card={card} stage={card.stage} first={first} last onOpen={onOpen} strong>
        <Detail card={card} stage={card.stage} />
        <div className={`mt-2 flex items-center justify-between font-medium ${missing.length ? "text-amber-700" : "text-green-700"}`}>
          <span>{missing.length ? `${missing.length} to fill` : "Ready"}</span>
          <span className="text-base leading-none text-muted" aria-hidden>
            ⋮⋮
          </span>
        </div>
      </StepBody>
    </div>
  );
}

function FutureCell({ card, stage, dragging, next }: { card: BoardCard; stage: Stage; dragging: boolean; next: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${card.id}|${stage}` });
  const check = dragging ? checkMove(toGateCard(card), stage) : null;
  const color = stageColor(stage);
  return (
    <div ref={setNodeRef} className="h-full px-1">
      {!dragging && next && (
        <div className="flex h-full items-center justify-center rounded-md border border-dashed border-line p-2 text-center text-xs text-muted">
          Drag here when ready
        </div>
      )}
      {dragging && check && (
        <div
          className="flex h-full items-center justify-center rounded-md border-2 border-dashed p-2 text-center text-xs"
          style={{
            borderColor: check.ok ? color : "var(--color-red-300)",
            background: isOver ? `color-mix(in oklab, ${check.ok ? color : "var(--color-red-300)"} 20%, transparent)` : undefined,
            color: check.ok ? color : "var(--color-red-700)",
          }}
        >
          {check.ok ? `Release to expand into ${STAGE_LABELS[stage]}` : `Locked until ${STAGE_LABELS[check.stage]} is filled in`}
        </div>
      )}
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const clamp = (s: string | null | undefined, n: number) => (s && s.length > n ? s.slice(0, n).trimEnd() + "..." : (s ?? ""));

/** One short fact for a finished step. */
function fact(c: BoardCard, stage: Stage): string {
  switch (stage) {
    case "assumption":
      return plural(c.assumptions.length, "assumption");
    case "hypothesis":
      return [filled(c.howMany) && clamp(c.howMany, 30), filled(c.byWhen) && `by ${clamp(c.byWhen, 24)}`].filter(Boolean).join(", ") || "Written";
    case "experiment":
      return c.title || plural(c.metrics.length, "metric");
    case "running":
      return plural(c.runs.length, "session");
    case "results": {
      const r = { pass: 0, fail: 0, unclear: 0 };
      for (const m of c.metrics) if (m.result) r[m.result]++;
      return [r.pass && `${r.pass} pass`, r.fail && `${r.fail} fail`, r.unclear && `${r.unclear} unclear`].filter(Boolean).join(", ") || "Written up";
    }
    case "decision":
      return c.decision ? c.decision.charAt(0).toUpperCase() + c.decision.slice(1) : "";
    default:
      return "";
  }
}

/** A few lines about the step the experiment is on now. */
function Detail({ card: c, stage }: { card: BoardCard; stage: Stage }) {
  const none = <p className="text-muted">Nothing yet</p>;
  switch (stage) {
    case "assumption":
      if (!c.assumptions.length) return none;
      return (
        <>
          <p className="line-clamp-3">{c.assumptions[0].statement}</p>
          {c.assumptions.length > 1 && <p className="mt-1 text-muted">plus {c.assumptions.length - 1} more</p>}
        </>
      );
    case "hypothesis":
      if (!filled(c.who) && !filled(c.action)) return none;
      return (
        <p className="line-clamp-3">
          {filled(c.who) ? c.who : "Someone"} will {filled(c.action) ? c.action!.charAt(0).toLowerCase() + c.action!.slice(1) : "..."}
        </p>
      );
    case "experiment":
      if (!c.startDate && !c.metrics.length && !c.title) return none;
      return (
        <>
          {c.title && <p className="line-clamp-2">{c.title}</p>}
          <p className="text-muted">
            {c.startDate ? fmtDate(c.startDate) : "No start"} to {c.reportDate ? fmtDate(c.reportDate) : "no report date"}
          </p>
          <p className="mt-1 text-muted">{plural(c.metrics.length, "metric")}</p>
        </>
      );
    case "running": {
      const readings = c.metrics.reduce((n, m) => n + m.readings.length, 0);
      if (!c.runs.length && !readings) return none;
      return (
        <p>
          {plural(c.runs.length, "session")}, {plural(readings, "reading")}
        </p>
      );
    }
    case "results": {
      const decided = c.metrics.filter((m) => m.result).length;
      return (
        <p>
          {decided} of {plural(c.metrics.length, "metric")} scored
        </p>
      );
    }
    case "decision":
      return c.decision ? <p className="font-semibold capitalize">{c.decision}</p> : none;
    default:
      return null;
  }
}
