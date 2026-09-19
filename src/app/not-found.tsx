import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid w-full max-w-[720px] place-items-center px-4 py-24 text-center">
      <span className="t-label">error 404</span>
      <h1 className="mt-3 text-[clamp(1.8rem,1.2rem+3vw,3rem)] leading-none font-bold tracking-[-0.04em]">
        ROUTE NOT FOUND
      </h1>
      <p className="mt-4 max-w-md text-[0.82rem] leading-relaxed text-dim">
        That address isn&apos;t part of the engine. Head back to the console and
        paste a media link.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary px-5">
          Open downloader
        </Link>
        <Link href="/video-hub" className="btn px-5">
          Video hub
        </Link>
      </div>
    </div>
  );
}
