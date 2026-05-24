import Link from "next/link";

import { RequestPasswordResetForm } from "@/components/forms/request-password-reset-form";

export default function ResetHaslaPage() {
  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
      <h1 className="mb-2 text-2xl font-semibold">Reset hasła</h1>
      <p className="mb-6 text-sm text-white/70">Podaj email, a wyślemy link do ustawienia nowego hasła.</p>

      <RequestPasswordResetForm />

      <p className="mt-6 text-sm text-white/75">
        Pamiętasz hasło?{" "}
        <Link href="/logowanie" className="text-[#63A8FF] hover:underline">
          Wróć do logowania
        </Link>
      </p>
    </div>
  );
}
