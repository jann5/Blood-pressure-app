import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { logServerError } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const getSafeNextPath = (nextParam: string | null): string => {
  if (!nextParam || !nextParam.startsWith("/")) {
    return "/";
  }

  return nextParam;
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNextPath(searchParams.get("next"));

  const redirectUrl = new URL(next, origin);
  const loginUrl = new URL("/logowanie", origin);

  try {
    const supabase = await createServerSupabaseClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        logServerError("auth/confirm-exchange-code", error, { next });
        loginUrl.searchParams.set("error", "Nieprawidłowy lub wygasły link.");
        return NextResponse.redirect(loginUrl);
      }

      return NextResponse.redirect(redirectUrl);
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        logServerError("auth/confirm-verify-otp", error, { type, next });
        loginUrl.searchParams.set("error", "Nieprawidłowy lub wygasły link.");
        return NextResponse.redirect(loginUrl);
      }

      return NextResponse.redirect(redirectUrl);
    }

    loginUrl.searchParams.set("error", "Brak wymaganych parametrów linku.");
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    logServerError("auth/confirm-unexpected", error, { next });
    loginUrl.searchParams.set("error", "Nie udało się potwierdzić operacji.");
    return NextResponse.redirect(loginUrl);
  }
}
