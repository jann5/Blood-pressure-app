import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAndRedirectAction } from "@/actions/auth";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { DeleteAccountForm } from "@/components/forms/delete-account-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export default async function ProfilPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/logowanie");
  }

  const { count } = await supabase
    .from("blood_pressure_readings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profil</h1>
          <p className="text-sm text-white/70">Zarządzanie kontem</p>
        </div>

        <div className="flex gap-3">
          <Link href="/" className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
            Dashboard
          </Link>
          <form action={signOutAndRedirectAction}>
            <button type="submit" className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              Wyloguj
            </button>
          </form>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-lg font-semibold">Informacje o koncie</h2>
        <dl className="space-y-2 text-sm text-white/80">
          <div className="flex flex-col sm:flex-row sm:justify-between">
            <dt>Email</dt>
            <dd>{user.email ?? "Brak"}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between">
            <dt>Data dołączenia</dt>
            <dd>{user.created_at ? formatDate(user.created_at) : "Brak danych"}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between">
            <dt>Liczba pomiarów</dt>
            <dd>{count ?? 0}</dd>
          </div>
        </dl>
      </section>

      <ChangePasswordForm />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-lg font-semibold">Eksport danych</h2>
        <p className="mb-4 text-sm text-white/75">
          Pobierz wszystkie pomiary w formacie CSV.
        </p>
        <a
          href="/api/eksport-csv"
          className="inline-flex rounded-xl bg-[#0A84FF] px-4 py-2 text-sm font-semibold text-white"
        >
          Pobierz CSV
        </a>
      </section>

      <DeleteAccountForm />
    </div>
  );
}
