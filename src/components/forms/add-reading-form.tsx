"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import { addReadingAction } from "@/actions/readings";
import type { ActionResult } from "@/lib/actions/types";

type MessageData = {
  message: string;
};

const toLocalDateTimeValue = (date: Date): string => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function AddReadingForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const defaultMeasuredAt = useMemo(() => toLocalDateTimeValue(new Date()), []);

  const [state, formAction, isPending] = useActionState<ActionResult<MessageData> | null, FormData>(
    addReadingAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const errorMessage = state && !state.success ? state.error : null;
  const successMessage = state?.success ? state.data?.message : null;

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold">Dodaj pomiar</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="systolic" className="text-sm text-white/75">
            Skurczowe
          </label>
          <input
            id="systolic"
            name="systolic"
            type="number"
            min={60}
            max={280}
            required
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#0A84FF]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="diastolic" className="text-sm text-white/75">
            Rozkurczowe
          </label>
          <input
            id="diastolic"
            name="diastolic"
            type="number"
            min={30}
            max={180}
            required
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#0A84FF]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="pulse" className="text-sm text-white/75">
            Puls
          </label>
          <input
            id="pulse"
            name="pulse"
            type="number"
            min={30}
            max={240}
            required
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#0A84FF]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="measuredAt" className="text-sm text-white/75">
          Data i godzina pomiaru
        </label>
        <input
          id="measuredAt"
          name="measuredAt"
          type="datetime-local"
          defaultValue={defaultMeasuredAt}
          required
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#0A84FF]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="note" className="text-sm text-white/75">
          Notatka (opcjonalnie)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#0A84FF]"
        />
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-[#0A84FF] px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Zapisywanie..." : "Zapisz pomiar"}
      </button>
    </form>
  );
}
