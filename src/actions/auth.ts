"use server";

import { redirect } from "next/navigation";

import { actionError, actionOk, type ActionResult } from "@/lib/actions/types";
import { mapAuthErrorToPolish } from "@/lib/auth-errors";
import { getAppUrl } from "@/lib/env";
import { logServerError } from "@/lib/logger";
import {
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type MessageData = {
  message: string;
};

const getFormValue = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const getValidationMessage = (issues: { message?: string }[]): string => {
  return issues[0]?.message ?? "Nieprawidłowe dane formularza.";
};

export async function signInAction(
  _prevState: ActionResult<MessageData> | null,
  formData: FormData
): Promise<ActionResult<MessageData>> {
  const payload = {
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password"),
  };

  const parsed = signInSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError(getValidationMessage(parsed.error.issues));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      logServerError("auth/sign-in", error, { email: parsed.data.email });
      return actionError(
        mapAuthErrorToPolish(error, "Nie udało się zalogować. Spróbuj ponownie.")
      );
    }

    return actionOk({ message: "Zalogowano pomyślnie." });
  } catch (error) {
    logServerError("auth/sign-in-unexpected", error);
    return actionError("Nie udało się zalogować. Spróbuj ponownie.");
  }
}

export async function signUpAction(
  _prevState: ActionResult<MessageData> | null,
  formData: FormData
): Promise<ActionResult<MessageData>> {
  const payload = {
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password"),
    confirmPassword: getFormValue(formData, "confirmPassword"),
  };

  const parsed = signUpSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError(getValidationMessage(parsed.error.issues));
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return actionError("Hasła nie są takie same.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/potwierdz?next=/`,
      },
    });

    if (error) {
      logServerError("auth/sign-up", error, { email: parsed.data.email });
      return actionError(
        mapAuthErrorToPolish(error, "Nie udało się utworzyć konta. Spróbuj ponownie.")
      );
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return actionError("Konto z tym emailem już istnieje.");
    }

    return actionOk({
      message: "Sprawdź skrzynkę email i kliknij link potwierdzający rejestrację.",
    });
  } catch (error) {
    logServerError("auth/sign-up-unexpected", error);
    return actionError("Nie udało się utworzyć konta. Spróbuj ponownie.");
  }
}

export async function requestPasswordResetAction(
  _prevState: ActionResult<MessageData> | null,
  formData: FormData
): Promise<ActionResult<MessageData>> {
  const payload = {
    email: getFormValue(formData, "email"),
  };

  const parsed = requestPasswordResetSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError(getValidationMessage(parsed.error.issues));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getAppUrl()}/auth/potwierdz?next=/nowe-haslo`,
    });

    if (error) {
      logServerError("auth/request-password-reset", error, { email: parsed.data.email });
      return actionError(
        mapAuthErrorToPolish(error, "Nie udało się wysłać linku resetującego. Spróbuj ponownie.")
      );
    }

    return actionOk({
      message:
        "Jeśli konto istnieje, wysłaliśmy wiadomość email z linkiem do ustawienia nowego hasła.",
    });
  } catch (error) {
    logServerError("auth/request-password-reset-unexpected", error);
    return actionError("Nie udało się wysłać linku resetującego. Spróbuj ponownie.");
  }
}

export async function setNewPasswordAction(
  _prevState: ActionResult<MessageData> | null,
  formData: FormData
): Promise<ActionResult<MessageData>> {
  const payload = {
    password: getFormValue(formData, "password"),
    confirmPassword: getFormValue(formData, "confirmPassword"),
  };

  const parsed = updatePasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError(getValidationMessage(parsed.error.issues));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return actionError("Link do ustawienia hasła jest nieprawidłowy lub wygasł.");
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) {
      logServerError("auth/set-new-password", error, { userId: user.id });
      return actionError(
        mapAuthErrorToPolish(error, "Nie udało się ustawić nowego hasła. Spróbuj ponownie.")
      );
    }

    return actionOk({ message: "Hasło zostało zmienione." });
  } catch (error) {
    logServerError("auth/set-new-password-unexpected", error);
    return actionError("Nie udało się ustawić nowego hasła. Spróbuj ponownie.");
  }
}

export async function signOutAction(): Promise<ActionResult<MessageData>> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      logServerError("auth/sign-out", error);
      return actionError("Nie udało się wylogować. Spróbuj ponownie.");
    }

    return actionOk({ message: "Wylogowano." });
  } catch (error) {
    logServerError("auth/sign-out-unexpected", error);
    return actionError("Nie udało się wylogować. Spróbuj ponownie.");
  }
}

export async function signOutAndRedirectAction(): Promise<void> {
  await signOutAction();
  redirect("/logowanie");
}
