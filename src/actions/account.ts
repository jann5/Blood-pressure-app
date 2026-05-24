"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionError, actionOk, type ActionResult } from "@/lib/actions/types";
import { mapAuthErrorToPolish } from "@/lib/auth-errors";
import { logServerError } from "@/lib/logger";
import { changePasswordSchema } from "@/lib/schemas";
import {
  createPasswordVerificationClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/admin";
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

export async function changePasswordAction(
  _prevState: ActionResult<MessageData> | null,
  formData: FormData
): Promise<ActionResult<MessageData>> {
  const payload = {
    currentPassword: getFormValue(formData, "currentPassword"),
    newPassword: getFormValue(formData, "newPassword"),
    confirmNewPassword: getFormValue(formData, "confirmNewPassword"),
  };

  const parsed = changePasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError(getValidationMessage(parsed.error.issues));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      return actionError("Sesja wygasła. Zaloguj się ponownie.");
    }

    const verificationClient = createPasswordVerificationClient();
    const { error: verifyError } = await verificationClient.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    });

    if (verifyError) {
      logServerError("account/change-password-verify", verifyError, { userId: user.id });
      return actionError("Obecne hasło jest nieprawidłowe.");
    }

    await verificationClient.auth.signOut({ scope: "local" });

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });

    if (updateError) {
      logServerError("account/change-password", updateError, { userId: user.id });
      return actionError(
        mapAuthErrorToPolish(updateError, "Nie udało się zmienić hasła. Spróbuj ponownie.")
      );
    }

    return actionOk({ message: "Hasło zostało zmienione." });
  } catch (error) {
    logServerError("account/change-password-unexpected", error);
    return actionError("Nie udało się zmienić hasła. Spróbuj ponownie.");
  }
}

export async function deleteAccountAction(
  _prevState: ActionResult<MessageData> | null,
  _formData: FormData
): Promise<ActionResult<MessageData>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return actionError("Sesja wygasła. Zaloguj się ponownie.");
    }

    const admin = getSupabaseAdminClient();

    const { error: readingsDeleteError } = await admin
      .from("blood_pressure_readings")
      .delete()
      .eq("user_id", user.id);

    if (readingsDeleteError) {
      logServerError("account/delete-readings", readingsDeleteError, { userId: user.id });
      return actionError("Nie udało się usunąć danych konta.");
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id, false);

    if (deleteUserError) {
      logServerError("account/delete-auth-user", deleteUserError, { userId: user.id });
      return actionError("Nie udało się usunąć konta.");
    }

    await supabase.auth.signOut({ scope: "local" });

    revalidatePath("/");
    revalidatePath("/profil");

    return actionOk({ message: "Konto zostało usunięte." });
  } catch (error) {
    logServerError("account/delete-unexpected", error);
    return actionError("Nie udało się usunąć konta.");
  }
}

export async function deleteAccountAndRedirectAction(
  prevState: ActionResult<MessageData> | null,
  formData: FormData
): Promise<ActionResult<MessageData>> {
  const result = await deleteAccountAction(prevState, formData);

  if (result.success) {
    redirect("/logowanie");
  }

  return result;
}
