"use client";
// The board: one row per experiment. A row fills in left to right as the experiment moves
// through the chain (BRIEF section 4). Drag the current step into a later column to expand
// the row (gated), or into an earlier one to move it back. Click any step to open the drawer there.
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { BoardCard } from "@/lib/board-data";
import { BOARD_STAGES, blockedMessage, checkMove, filled, isStale, missingFor, toGateCard, type Stage } from "@/lib/gates";
import { experimentName, experimentSubtitle, fmtDate, STAGE_LABELS, STATUS_STYLES } from "@/lib/format";
import { Pill, SeedFlag } from "@/components/ui";
import { createCard, createNextExperiment, moveCard } from "@/app/actions";
import { Drawer, type Lists } from "./Drawer";
import { Button, inputCls, ToastContext, useAction } from "./fields";
import { TypePicker, type ExperimentType } from "./TypePicker";

const WIP_LIMIT = 3;
const STAGE_INDEX = Object.fromEntries(BOARD_STAGES.map((s, i) => [s, i])) as Record<Stage, number>;
const GRID = { gridTemplateColumns: `250px repeat(${BOARD_STAGES.length}, 180px)` };
export const stageColor = (s: Stage) => `var(--color-stage-${s === "closed" ? "decision" : s})`;

type View = "list" | "assumptions";
type Props = { cards: BoardCard[]; lists: Lists; initialOpen?: string; initialView?: View };
type Assumption = Lists["assumptions"][number];
type Scored = { importance: number; evidence: number };

// Riskiest first: most important, least evidence.
const riskier = (a: Scored, b: Scored) => b.importance - a.importance || a.evidence - b.evidence;
/** The assumption an experiment is filed under when grouping: its riskiest linked one. */
const primaryOf = (c: BoardCard) => [...c.assumptions].sort(riskier)[0] ?? null;
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

function BoardInner({ cards, lists, initialOpen, initialView = "list" }: Props) {
  const toast = useContext(ToastContext);
  const { run } = useAction();
  const [openState, setOpenState] = useState<{ id: string; focus?: Stage } | null>(initialOpen ? { id: initialOpen } : null);
  const [moved, setMoved] = useState<Record<string, Stage>>({}); // optimistic stage while a move saves
  const [dragId, setDragId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [view, setView] = useState<View>(initialView);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const now = useMemo(() => new Date(), []);

  // Keep the open card and the view in the URL so a link or reload brings them back.
  const setParam = (key: string, value: string | null) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  };
  const open: Opener = (id, focus) => {
    setOpenState(id ? { id, focus } : null);
    setParam("card", id);
  };
  const switchView = (v: View) => {
    setView(v);
    setParam("view", v === "list" ? null : v);
  };

  const withStage = (c: BoardCard) => ({ ...c, stage: moved[c.id] ?? c.stage });
  const q = query.trim().toLowerCase();
  const visible = cards.map(withStage).filter((c) => !q || `${experimentName(c)} ${c.title ?? ""}`.toLowerCase().includes(q));
  // stale first, then furthest along, then oldest
  const active = visible
    .filter((c) => c.stage !== "closed")
    .sort((a, b) => Number(isStale(b, now)) - Number(isStale(a, now)) || STAGE_INDEX[b.stage] - STAGE_INDEX[a.stage]);
  const closed = visible.filter((c) => c.stage === "closed");
  const running = active.filter((c) => c.stage === "running").length;
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
      <Toolbar query={query} setQuery={setQuery} onCreated={(id) => open(id)} view={view} setView={switchView} types={lists.types} />
      {running > WIP_LIMIT && (
        <div className="mb-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {running} experiments are running. More than {WIP_LIMIT} at once makes it hard to learn from any of them.
        </div>
      )}

      {/* A fixed id keeps dnd-kit's generated ids the same on the server and in the browser. */}
      <DndContext id="board" sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={onDragEnd}>
        <div className="-mx-4 overflow-x-auto px-4 pb-4">
          <div className="grid min-w-max gap-y-2" style={GRID}>
            <HeaderRow />
            {active.length === 0 && view === "list" && <div className="col-span-full py-6 text-sm text-muted">No experiments match.</div>}
            {view === "list" ? (
              active.map((c) => <Row key={c.id} card={c} now={now} dragging={dragId === c.id} onOpen={open} />)
            ) : (
              <Grouped
                cards={showClosed ? visible : active}
                assumptions={lists.assumptions}
                types={lists.types}
                now={now}
                dragId={dragId}
                onOpen={open}
                searching={!!q}
              />
            )}
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
        <button className="text-sm text-muted hover:text-ink" onClick={() => setShowClosed(!showClosed)}>
          {showClosed ? "Hide" : "Show"} closed experiments ({closed.length}){view === "assumptions" && " in their groups"}
        </button>
        {showClosed && view === "list" && (
          <div className="-mx-4 mt-2 overflow-x-auto px-4 pb-4">
            <div className="grid min-w-max gap-y-2" style={GRID}>
              {closed.map((c) => (
                <ClosedRow key={c.id} card={c} onOpen={open} />
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
  view,
  setView,
  types,
}: {
  query: string;
  setQuery: (q: string) => void;
  onCreated: (id: string) => void;
  view: View;
  setView: (v: View) => void;
  types: ExperimentType[];
}) {
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
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
          Add experiment
        </Button>
      </form>
      <div className="ml-auto flex overflow-hidden rounded-md border border-line text-sm" role="group" aria-label="Board view">
        <button onClick={() => setView("list")} className={`px-3 py-1.5 ${view === "list" ? "bg-raised font-medium text-ink" : "text-muted hover:text-ink"}`}>
          List
        </button>
        <button onClick={() => setView("assumptions")} className={`px-3 py-1.5 ${view === "assumptions" ? "bg-raised font-medium text-ink" : "text-muted hover:text-ink"}`}>
          Group by assumption
        </button>
      </div>
      <input className={`${inputCls} w-56`} placeholder="Search experiments" value={query} onChange={(e) => setQuery(e.target.value)} />
    </div>
  );
}

/**
 * Group by assumption: one band per assumption (riskiest first) with the experiments filed
 * under it in the order they were started, so repeated cycles read top to bottom.
 * An experiment that tests several assumptions appears once, under its riskiest one.
 */
function Grouped({
  cards,
  assumptions,
  types,
  now,
  dragId,
  onOpen,
  searching,
}: {
  cards: BoardCard[];
  assumptions: Assumption[];
  types: ExperimentType[];
  now: Date;
  dragId: string | null;
  onOpen: Opener;
  searching: boolean;
}) {
  const [showUntested, setShowUntested] = useState(false);
  const byAssumption = new Map<string, BoardCard[]>();
  const unlinked: BoardCard[] = [];
  for (const c of [...cards].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))) {
    const p = primaryOf(c);
    if (!p) unlinked.push(c);
    else byAssumption.set(p.id, [...(byAssumption.get(p.id) ?? []), c]);
  }
  const sorted = [...assumptions].sort(riskier);
  const withRows = sorted.filter((a) => byAssumption.has(a.id));
  const without = sorted.filter((a) => !byAssumption.has(a.id));
  const rows = (list: BoardCard[], bandId?: string) =>
    list.map((c) => {
      const also = c.assumptions.filter((a) => a.id !== bandId);
      return c.stage === "closed" ? (
        <ClosedRow key={c.id} card={c} onOpen={onOpen} alsoTests={also} />
      ) : (
        <Row key={c.id} card={c} now={now} dragging={dragId === c.id} onOpen={onOpen} alsoTests={also} />
      );
    });

  return (
    <>
      {withRows.map((a) => (
        <Band key={a.id} assumption={a} count={byAssumption.get(a.id)!.length} onOpen={onOpen} types={types}>
          {rows(byAssumption.get(a.id)!, a.id)}
        </Band>
      ))}
      {unlinked.length > 0 && (
        <>
          <div className="sticky left-0 col-span-full mt-4 text-sm font-semibold text-muted">No assumption linked yet</div>
          {rows(unlinked)}
        </>
      )}
      {!searching && without.length > 0 && (
        <div className="sticky left-0 col-span-full mt-4 max-w-4xl">
          <button className="text-sm text-muted hover:text-ink" onClick={() => setShowUntested(!showUntested)}>
            {showUntested ? "Hide" : "Show"} assumptions with no experiment yet ({without.length})
          </button>
          {showUntested && (
            <div className="mt-2 space-y-2">
              {without.map((a) => (
                <BandHeader key={a.id} assumption={a} onOpen={onOpen} types={types} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Band({
  assumption,
  count,
  onOpen,
  types,
  children,
}: {
  assumption: Assumption;
  count: number;
  onOpen: Opener;
  types: ExperimentType[];
  children: React.ReactNode;
}) {
  return (
    <>
      <div id={`band-${assumption.id}`} className="sticky left-0 col-span-full mt-4 max-w-4xl scroll-mt-4">
        <BandHeader assumption={assumption} count={count} onOpen={onOpen} types={types} />
      </div>
      {children}
    </>
  );
}

function BandHeader({ assumption: a, count, onOpen, types }: { assumption: Assumption; count?: number; onOpen: Opener; types: ExperimentType[] }) {
  const { run } = useAction();
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-3 py-2">
      <Pill className={STATUS_STYLES[a.status]}>{a.status}</Pill>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{a.statement}</div>
        <div className="text-xs text-muted">
          {a.category}, importance {a.importance} of 5, evidence {a.evidence} of 5
          {count != null && `, ${count} experiment${count === 1 ? "" : "s"}`}
        </div>
      </div>
      <TypePicker
        types={types}
        placeholder="+ New experiment"
        className="w-44 py-1 text-xs"
        onPick={(typeId) => run(() => createCard(typeId, "", a.id), (r) => r.ok && r.id && onOpen(r.id))}
      />
    </div>
  );
}

function HeaderRow() {
  return (
    <>
      <div className="sticky left-0 z-10 bg-paper pr-3 text-xs font-semibold uppercase tracking-wide text-muted">Experiment</div>
      {BOARD_STAGES.map((s) => (
        <div key={s} className="flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: stageColor(s) }} />
          {STAGE_LABELS[s]}
        </div>
      ))}
    </>
  );
}

function TitleCell({
  card: c,
  now,
  onOpen,
  alsoTests,
  children,
}: {
  card: BoardCard;
  now?: Date;
  onOpen: Opener;
  alsoTests?: { id: string; statement: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky left-0 z-10 bg-paper pr-3">
      <div className="h-full rounded-l-lg border-l-4 bg-surface p-3" style={{ borderLeftColor: stageColor(c.stage) }}>
        <button className="text-left text-sm font-semibold leading-snug hover:underline" onClick={() => onOpen(c.id)}>
          {experimentName(c)}
        </button>
        {experimentSubtitle(c) && <div className="text-xs leading-snug text-muted">{experimentSubtitle(c)}</div>}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {now && isStale(c, now) && <Pill className="bg-red-100 text-red-800">past report date</Pill>}
          {c.siblingGroup && <Pill className="bg-sky-100 text-sky-800">split</Pill>}
          <SeedFlag tags={c.tags} />
        </div>
        {alsoTests && alsoTests.length > 0 && (
          <div className="mt-1.5 text-xs text-muted">
            Also tests:{" "}
            {alsoTests.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <a href={`#band-${a.id}`} className="underline decoration-dotted hover:text-ink" title={a.statement}>
                  {a.statement.length > 40 ? a.statement.slice(0, 40).trimEnd() + "..." : a.statement}
                </a>
              </span>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

type AlsoTests = { id: string; statement: string }[];

function Row({ card: c, now, dragging, onOpen, alsoTests }: { card: BoardCard; now: Date; dragging: boolean; onOpen: Opener; alsoTests?: AlsoTests }) {
  const current = STAGE_INDEX[c.stage];
  const missing = missingFor(c.stage, toGateCard(c)).length;
  return (
    <>
      <TitleCell card={c} now={now} onOpen={onOpen} alsoTests={alsoTests}>
        <div className={`mt-1.5 text-xs ${missing ? "text-amber-700" : "text-green-700"}`}>
          {missing ? `${missing} to fill in ${STAGE_LABELS[c.stage]}` : `Ready to expand into ${STAGE_LABELS[BOARD_STAGES[current + 1]] ?? "closing"}`}
        </div>
      </TitleCell>
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

function ClosedRow({ card: c, onOpen, alsoTests }: { card: BoardCard; onOpen: Opener; alsoTests?: AlsoTests }) {
  const { run, pending } = useAction();
  return (
    <>
      <TitleCell card={c} onOpen={onOpen} alsoTests={alsoTests}>
        <div className="mt-1 text-xs text-muted">Closed {fmtDate(c.closedAt)}</div>
        <div className="mt-2">
          <Button disabled={pending} onClick={() => run(() => createNextExperiment(c.id), (r) => r.ok && r.id && onOpen(r.id))}>
            Start next cycle
          </Button>
        </div>
      </TitleCell>
      {BOARD_STAGES.map((s, i) => (
        <StepBody key={s} card={c} stage={s} first={i === 0} last={i === BOARD_STAGES.length - 1} onOpen={onOpen} dim />
      ))}
    </>
  );
}

/** A filled step: tinted with its column's color, showing a short summary. */
function StepBody({
  card,
  stage,
  first,
  last,
  onOpen,
  dim,
  strong,
  children,
}: {
  card: BoardCard;
  stage: Stage;
  first?: boolean;
  last?: boolean;
  onOpen: Opener;
  dim?: boolean;
  strong?: boolean;
  children?: React.ReactNode;
}) {
  const color = stageColor(stage);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(card.id, stage)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(card.id, stage)}
      className={`h-full cursor-pointer border-y border-r border-line p-3 text-xs leading-relaxed hover:brightness-125 ${first ? "border-l" : ""} ${last ? "rounded-r-lg" : ""} ${dim ? "opacity-80" : ""}`}
      style={{
        background: `color-mix(in oklab, ${color} ${strong ? 26 : 14}%, var(--color-surface))`,
        borderTopColor: strong ? color : undefined,
        borderTopWidth: strong ? 2 : undefined,
      }}
    >
      <Brief card={card} stage={stage} />
      {children}
    </div>
  );
}

function DoneCell({ card, stage, first, onOpen }: { card: BoardCard; stage: Stage; first: boolean; onOpen: Opener }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${card.id}|${stage}` });
  return (
    <div ref={setNodeRef} className={isOver ? "outline outline-2 -outline-offset-2 outline-stone-400" : ""}>
      <StepBody card={card} stage={stage} first={first} onOpen={onOpen} />
    </div>
  );
}

/** The step the experiment is on now. This is what you drag. */
function CurrentCell({ card, first, onOpen }: { card: BoardCard; first: boolean; onOpen: Opener }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  const missing = missingFor(card.stage, toGateCard(card));
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`h-full ${isDragging ? "opacity-50" : ""}`} title="Click to open. Drag right to expand.">
      <StepBody card={card} stage={card.stage} first={first} last onOpen={onOpen} strong>
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

/** Two or three lines summarizing one step of an experiment. */
function Brief({ card: c, stage }: { card: BoardCard; stage: Stage }) {
  const clamp = (s: string | null | undefined, n = 90) => (s && s.length > n ? s.slice(0, n).trimEnd() + "..." : s);
  const none = <span className="text-muted">Nothing yet</span>;
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
        <>
          <p className="line-clamp-3">
            {filled(c.who) ? c.who : "Someone"} will {filled(c.action) ? c.action!.charAt(0).toLowerCase() + c.action!.slice(1) : "..."}
          </p>
          <p className="mt-1 text-muted">
            {[filled(c.howMany) && clamp(c.howMany, 30), filled(c.byWhen) && `by ${clamp(c.byWhen, 30)}`].filter(Boolean).join(", ")}
          </p>
        </>
      );
    case "experiment":
      if (!c.startDate && !c.metrics.length && !c.title) return none;
      return (
        <>
          <p className="line-clamp-2">{c.title || c.type?.name || "No type"}</p>
          <p className="text-muted">
            {c.startDate ? fmtDate(c.startDate) : "No start"} to {c.reportDate ? fmtDate(c.reportDate) : "no report date"}
          </p>
          <p className="mt-1 line-clamp-2">
            {c.metrics.length ? `${c.metrics.length} metric${c.metrics.length === 1 ? "" : "s"}: ${c.metrics[0].name}` : "No metrics yet"}
          </p>
        </>
      );
    case "running": {
      const readings = c.metrics.reduce((n, m) => n + m.readings.length, 0);
      const evidence = c.runs.reduce((n, r) => n + r.evidence.length, 0);
      if (!c.runs.length && !readings) return none;
      return (
        <>
          <p>
            {c.runs.length} session{c.runs.length === 1 ? "" : "s"}, {evidence} evidence
          </p>
          <p className="text-muted">
            {readings} reading{readings === 1 ? "" : "s"}
          </p>
        </>
      );
    }
    case "results": {
      const r = { pass: 0, fail: 0, unclear: 0 };
      for (const m of c.metrics) if (m.result) r[m.result]++;
      if (!r.pass && !r.fail && !r.unclear && !filled(c.rawLearnings)) return none;
      return (
        <>
          <p>
            {r.pass} pass, {r.fail} fail, {r.unclear} unclear
          </p>
          {filled(c.insights ?? c.rawLearnings) && <p className="mt-1 line-clamp-2 text-muted">{c.insights ?? c.rawLearnings}</p>}
        </>
      );
    }
    case "decision":
      if (!c.decision) return none;
      return (
        <>
          <p className="font-semibold capitalize">{c.decision}</p>
          {c.decisionNote && <p className="mt-1 line-clamp-2 text-muted">{c.decisionNote}</p>}
        </>
      );
    default:
      return null;
  }
}
