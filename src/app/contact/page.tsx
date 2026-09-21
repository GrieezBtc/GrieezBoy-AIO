import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Report an Issue",
  description:
    "Report a problem with GRIEEZBOY AIO and send the details directly to customer care.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-[900px] px-3 pt-6 pb-24 sm:px-6 sm:pt-10 sm:pb-10 lg:px-8">
      <section className="panel-flat overflow-hidden p-4 sm:p-6">
        <div className="min-w-0">
          <span className="t-label">customer care / support</span>
          <h1 className="mt-2 text-[clamp(1.6rem,1.2rem+2.4vw,2.6rem)] leading-none font-bold tracking-[-0.05em]">
            REPORT AN ISSUE
          </h1>
          <p className="mt-3 max-w-2xl text-[0.78rem] leading-relaxed text-dim">
            Something failed, returned the wrong result or behaved
            unexpectedly? Send the details below. Your report goes directly
            to the GRIEEZBOY AIO support channel.
          </p>
        </div>

        <div className="mt-7 border-t border-line pt-6">
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
