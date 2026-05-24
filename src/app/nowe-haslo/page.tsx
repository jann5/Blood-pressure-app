import Link from "next/link";

import { SetNewPasswordForm } from "@/components/forms/set-new-password-form";

export default function NoweHasloPage() {
  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
      <h1 className="mb-2 text-2xl font-semibold">Ustaw nowe hasło</h1>
      <p className="mb-6 text-sm text-white/70">Wprowadź nowe hasło do swojego konta.</p>

      <SetNewPasswordForm />

      <p className="mt-6 text-sm text-white/75">
        <Link href="/logowanie" className="text-[#63A8FF] hover:underline">
          Wróć do logowania
        </Link>
      </p>
    </div>
  );
}
