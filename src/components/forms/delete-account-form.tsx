"use client";

import { useActionState } from "react";

import { deleteAccountAndRedirectAction } from "@/actions/account";
import type { ActionResult } from "@/lib/actions/types";

type MessageData = {
  message: string;
};

export function DeleteAccountForm() {
  const [state, formAction, isPending] = useActionState<ActionResult<MessageData> | null, FormData>(
    deleteAccountAndRedirectAction,
    null
  );

  const errorMessage = state && !state.success ? state.error : null;

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
      <h2 className="text-lg font-semibold text-red-200">Usuń konto</h2>
      <p className="text-sm text-red-100/90">
        Ta operacja usuwa konto i wszystkie pomiary ciśnienia bez możliwości przywrócenia.
      </p>

      {errorMessage ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/20 px-3 py-2 text-sm text-red-100">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Usuwanie konta..." : "Usuń konto"}
      </button>
    </form>
  );
}
