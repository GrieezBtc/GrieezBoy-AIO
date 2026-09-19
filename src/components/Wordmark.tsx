import Link from "next/link";

export function LogoGlyph({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center border"
      style={{
        width: size,
        height: size,
        borderColor: "var(--accent-line)",
        background:
          "linear-gradient(140deg, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)",
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"
          stroke="var(--accent)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M12 8v8m0 0 3.2-3.2M12 16l-3.2-3.2" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        className="absolute -right-px -bottom-px h-1.5 w-1.5"
        style={{ background: "var(--accent)" }}
      />
    </span>
  );
}

export function Wordmark({
  compact = false,
  href = "/",
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 outline-offset-4"
      aria-label="GRIEEZBOY AIO — home"
    >
      <LogoGlyph size={compact ? 30 : 36} />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={`font-bold tracking-[-0.03em] ${compact ? "text-[0.95rem]" : "text-[1.05rem]"}`}
        >
          GRIEEZBOY
          <span className="ml-1 text-accent">AIO</span>
        </span>
        {!compact ? (
          <span className="t-label mt-1 hidden text-[0.55rem] sm:block">
            multi-source media engine
          </span>
        ) : null}
      </span>
    </Link>
  );
}
