"use client";

import { useActionState } from "react";

import { changePasswordAction } from "@/actions/account";
import type { ActionResult } from "@/lib/actions/types";

type MessageData = {
  message: string;
};

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<ActionResult<MessageData> | null, FormData>(
    changePasswordAction,
    null
  );

  const errorMessage = state && !state.success ? state.error : null;
  const successMessage = state?.success ? state.data?.message : null;

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold">Zmień hasło</h2>

      <div className="space-y-2">
        <label htmlFor="currentPassword" className="text-sm text-white/75">
          Obecne hasło
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#0A84FF]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="newPassword" className="text-sm text-white/75">
          Nowe hasło
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#0A84FF]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmNewPassword" className="text-sm text-white/75">
          Powtórz nowe hasło
        </label>
        <input
          id="confirmNewPassword"
          name="confirmNewPassword"
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
        {isPending ? "Zapisywanie..." : "Zmień hasło"}
      </button>
    </form>
  );
}
