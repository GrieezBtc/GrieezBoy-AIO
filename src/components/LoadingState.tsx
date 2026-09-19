"use client";

export type Stage = "idle" | "analyzing" | "processing" | "ready" | "failed";

const STEPS: Array<{ id: Stage; label: string }> = [
  { id: "analyzing", label: "Analyzing" },
  { id: "processing", label: "Processing" },
  { id: "ready", label: "Ready" },
];

export function StagePipeline({ stage }: { stage: Stage }) {
  const activeIndex = STEPS.findIndex((step) => step.id === stage);
  return (
    <ol
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6rem] tracking-[0.18em] uppercase"
      aria-label="Processing pipeline"
    >
      {STEPS.map((step, index) => {
        const done = activeIndex > index && stage !== "failed";
        const active = activeIndex === index;
        const color = stage === "failed" && index >= activeIndex && activeIndex >= 0
          ? "var(--danger)"
          : done || active
            ? "var(--accent)"
            : "var(--text-faint)";
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              style={{ color }}
              className={active ? "live-dot font-bold" : done ? "font-bold" : ""}
            >
              {done ? "✓" : active ? "▮" : "·"} {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span aria-hidden className="text-faint">
                →
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function LoadingState({ stage }: { stage: Stage }) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="panel scanline reveal relative overflow-hidden p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StagePipeline stage={stage} />
        <span className="t-label text-[0.55rem]">
          {stage === "analyzing" ? "resolving source" : "extracting streams"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
        <div className="skeleton aspect-video w-full" />
        <div className="space-y-2.5">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="skeleton h-11 w-full" />
            <div className="skeleton h-11 w-full" />
            <div className="skeleton h-11 w-full" />
            <div className="skeleton h-11 w-full" />
          </div>
        </div>
      </div>
      <p className="sr-only">Processing your link. Please wait.</p>
    </section>
  );
}
