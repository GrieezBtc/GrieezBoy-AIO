import Link from "next/link";

export function LogoGlyph({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: "linear-gradient(145deg, var(--accent), var(--accent-2))",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(255,255,255,0.12), 0 6px 18px -8px var(--accent)",
      }}
    >
      <span
        className="absolute inset-x-0 top-0"
        style={{
          height: "48%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0))",
        }}
      />
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" className="relative">
        <path
          d="M12 4v10m0 0 4-4m-4 4-4-4"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6.5 19h11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
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
      className="group flex min-w-0 items-center gap-2.5 outline-offset-4"
      aria-label="GRIEEZBOY AIO — home"
    >
      <LogoGlyph size={compact ? 30 : 36} />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={`truncate font-bold tracking-[-0.03em] ${compact ? "text-[0.95rem]" : "text-[1.05rem]"}`}
        >
          GRIEEZBOY
          <span className="ml-1 text-accent">AIO</span>
        </span>
        {!compact ? (
          <span className="t-label mt-1 hidden text-[0.72rem] sm:block">
            multi-source media engine
          </span>
        ) : null}
      </span>
    </Link>
  );
}
