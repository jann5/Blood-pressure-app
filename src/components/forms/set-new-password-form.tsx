"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { setNewPasswordAction } from "@/actions/auth";
import type { ActionResult } from "@/lib/actions/types";

type MessageData = {
  message: string;
};

export function SetNewPasswordForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult<MessageData> | null, FormData>(
    setNewPasswordAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      const timer = window.setTimeout(() => {
        router.replace("/logowanie");
      }, 1200);

      return () => window.clearTimeout(timer);
    }

    return;
  }, [state, router]);

  const errorMessage = state && !state.success ? state.error : null;
  const successMessage = state?.success ? state.data?.message : null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm text-white/80">
          Nowe hasło
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#0A84FF]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="block text-sm text-white/80">
          Powtórz nowe hasło
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
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
        {isPending ? "Zapisywanie..." : "Ustaw nowe hasło"}
      </button>
    </form>
  );
}
