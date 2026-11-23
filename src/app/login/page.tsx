import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a free GRIEEZBOY AIO account.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-[460px] px-3 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-10">
      <section className="panel p-5 sm:p-7">
        <h1 className="text-2xl font-bold tracking-tight">Welcome</h1>
        <p className="mt-1.5 mb-6 text-[0.85rem] text-dim">
          Sign in to unlock every platform. New accounts start with 10 🪙 free coins.
        </p>
        <LoginForm />
      </section>
    </div>
  );
}
