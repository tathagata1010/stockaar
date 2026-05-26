import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MarketTickerStripAsync } from "@/components/MarketTickerStrip";
import { NavProgress } from "@/components/NavProgress";
import { PageTransition } from "@/components/anim/PageTransition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) redirect("/auth/login");
  const user = session.user;

  return (
    <div className="min-h-screen" style={{ ["--app-sticky-top" as string]: "100px" }}>
      <Suspense fallback={null}><NavProgress /></Suspense>
      <MarketTickerStripAsync />
      <Header email={user.email ?? ""} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PageTransition>{children}</PageTransition>
      </div>
      <Footer />
    </div>
  );
}
