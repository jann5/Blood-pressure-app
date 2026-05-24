import Link from "next/link";

import { LoginForm } from "@/components/forms/login-form";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LogowaniePage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
      <h1 className="mb-2 text-2xl font-semibold">Logowanie</h1>
      <p className="mb-6 text-sm text-white/70">Zaloguj się do swojego konta.</p>

      <LoginForm nextPath={next} initialError={error} />

      <div className="mt-6 space-y-2 text-sm text-white/75">
        <p>
          Nie masz konta?{" "}
          <Link href="/rejestracja" className="text-[#63A8FF] hover:underline">
            Zarejestruj się
          </Link>
        </p>
        <p>
          Nie pamiętasz hasła?{" "}
          <Link href="/reset-hasla" className="text-[#63A8FF] hover:underline">
            Zresetuj hasło
          </Link>
        </p>
      </div>
    </div>
  );
}
