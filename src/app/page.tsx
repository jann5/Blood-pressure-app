import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAndRedirectAction } from "@/actions/auth";
import {
  deleteReadingDirect,
  updateReadingDirect,
} from "@/actions/readings";
import { AddReadingForm } from "@/components/forms/add-reading-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type Reading = Database["public"]["Tables"]["blood_pressure_readings"]["Row"];

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const toDateTimeInputValue = (iso: string): string => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/logowanie");
  }

  const { data: readings } = await supabase
    .from("blood_pressure_readings")
    .select("*")
    .eq("user_id", user.id)
    .order("measured_at", { ascending: false });

  const safeReadings: Reading[] = readings ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Panel pomiarów</h1>
          <p className="text-sm text-white/70">Zalogowano jako: {user.email}</p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/profil"
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10"
          >
            Profil
          </Link>
          <form action={signOutAndRedirectAction}>
            <button
              type="submit"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </header>

      <AddReadingForm />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Twoje pomiary ({safeReadings.length})</h2>

        {safeReadings.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/75">
            Brak pomiarów. Dodaj pierwszy wpis.
          </p>
        ) : (
          <div className="space-y-3">
            {safeReadings.map((reading) => (
              <article key={reading.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">
                      {reading.systolic}/{reading.diastolic} mmHg
                    </p>
                    <p className="text-sm text-white/70">Puls: {reading.pulse} bpm</p>
                    <p className="text-sm text-white/70">{formatDate(reading.measured_at)}</p>
                    {reading.note ? (
                      <p className="mt-2 text-sm text-white/75">Notatka: {reading.note}</p>
                    ) : null}
                  </div>

                  <form action={deleteReadingDirect}>
                    <input type="hidden" name="id" value={reading.id} />
                    <button
                      type="submit"
                      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
                    >
                      Usuń
                    </button>
                  </form>
                </div>

                <details className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-white/85">Edytuj pomiar</summary>

                  <form action={updateReadingDirect} className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={reading.id} />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <input
                        name="systolic"
                        type="number"
                        min={60}
                        max={280}
                        defaultValue={reading.systolic}
                        required
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none"
                      />
                      <input
                        name="diastolic"
                        type="number"
                        min={30}
                        max={180}
                        defaultValue={reading.diastolic}
                        required
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none"
                      />
                      <input
                        name="pulse"
                        type="number"
                        min={30}
                        max={240}
                        defaultValue={reading.pulse}
                        required
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none"
                      />
                    </div>

                    <input
                      name="measuredAt"
                      type="datetime-local"
                      defaultValue={toDateTimeInputValue(reading.measured_at)}
                      required
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none"
                    />

                    <textarea
                      name="note"
                      rows={2}
                      maxLength={500}
                      defaultValue={reading.note ?? ""}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none"
                    />

                    <button
                      type="submit"
                      className="rounded-xl bg-[#0A84FF] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Zapisz zmiany
                    </button>
                  </form>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
