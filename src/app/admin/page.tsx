import type { Metadata } from "next";
import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 pt-6 pb-24 sm:px-6 sm:pt-10 sm:pb-10 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Site stats</h1>
      <p className="mt-1 mb-6 text-[0.85rem] text-dim">Private. Only admin emails can see this.</p>
      <AdminDashboard />
    </div>
  );
}
