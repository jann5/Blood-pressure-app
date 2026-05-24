import Link from "next/link";

import { SignupForm } from "@/components/forms/signup-form";

export default function RejestracjaPage() {
  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
      <h1 className="mb-2 text-2xl font-semibold">Rejestracja</h1>
      <p className="mb-6 text-sm text-white/70">Utwórz konto, aby zapisywać pomiary.</p>

      <SignupForm />

      <p className="mt-6 text-sm text-white/75">
        Masz już konto?{" "}
        <Link href="/logowanie" className="text-[#63A8FF] hover:underline">
          Zaloguj się
        </Link>
      </p>
    </div>
  );
}
