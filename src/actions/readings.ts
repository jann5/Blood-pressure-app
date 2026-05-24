"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionOk, type ActionResult } from "@/lib/actions/types";
import { logServerError } from "@/lib/logger";
import { deleteReadingSchema, readingSchema, updateReadingSchema } from "@/lib/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ReadingRow = Database["public"]["Tables"]["blood_pressure_readings"]["Row"];

type ReadingMessageData = {
  message: string;
  reading?: ReadingRow;
};

const getFormValue = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const getValidationMessage = (issues: { message?: string }[]): string => {
  return issues[0]?.message ?? "Nieprawidłowe dane formularza.";
};

const getAuthenticatedUserId = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, userId: null as string | null };
  }

  return { supabase, userId: user.id };
};

export async function addReadingAction(
  _prevState: ActionResult<ReadingMessageData> | null,
  formData: FormData
): Promise<ActionResult<ReadingMessageData>> {
  const parsed = readingSchema.safeParse({
    systolic: getFormValue(formData, "systolic"),
    diastolic: getFormValue(formData, "diastolic"),
    pulse: getFormValue(formData, "pulse"),
    measuredAt: getFormValue(formData, "measuredAt"),
    note: getFormValue(formData, "note"),
  });

  if (!parsed.success) {
    return actionError(getValidationMessage(parsed.error.issues));
  }

  try {
    const { supabase, userId } = await getAuthenticatedUserId();

    if (!userId) {
      return actionError("Sesja wygasła. Zaloguj się ponownie.");
    }

    const measuredAt = new Date(parsed.data.measuredAt).toISOString();

    const { data, error } = await supabase
      .from("blood_pressure_readings")
      .insert({
        user_id: userId,
        systolic: parsed.data.systolic,
        diastolic: parsed.data.diastolic,
        pulse: parsed.data.pulse,
        note: parsed.data.note,
        measured_at: measuredAt,
      })
      .select()
      .single();

    if (error) {
      logServerError("readings/add", error, { userId });
      return actionError("Nie udało się dodać pomiaru.");
    }

    revalidatePath("/");
    revalidatePath("/profil");

    return actionOk({ message: "Dodano pomiar.", reading: data });
  } catch (error) {
    logServerError("readings/add-unexpected", error);
    return actionError("Nie udało się dodać pomiaru.");
  }
}

export async function addReadingDirect(formData: FormData): Promise<void> {
  await addReadingAction(null, formData);
}

export async function updateReadingAction(
  _prevState: ActionResult<ReadingMessageData> | null,
  formData: FormData
): Promise<ActionResult<ReadingMessageData>> {
  const parsed = updateReadingSchema.safeParse({
    id: getFormValue(formData, "id"),
    systolic: getFormValue(formData, "systolic"),
    diastolic: getFormValue(formData, "diastolic"),
    pulse: getFormValue(formData, "pulse"),
    measuredAt: getFormValue(formData, "measuredAt"),
    note: getFormValue(formData, "note"),
  });

  if (!parsed.success) {
    return actionError(getValidationMessage(parsed.error.issues));
  }

  try {
    const { supabase, userId } = await getAuthenticatedUserId();

    if (!userId) {
      return actionError("Sesja wygasła. Zaloguj się ponownie.");
    }

    const measuredAt = new Date(parsed.data.measuredAt).toISOString();

    const { data, error } = await supabase
      .from("blood_pressure_readings")
      .update({
        systolic: parsed.data.systolic,
        diastolic: parsed.data.diastolic,
        pulse: parsed.data.pulse,
        note: parsed.data.note,
        measured_at: measuredAt,
      })
      .eq("id", parsed.data.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logServerError("readings/update", error, { userId, readingId: parsed.data.id });
      return actionError("Nie udało się zaktualizować pomiaru.");
    }

    revalidatePath("/");
    revalidatePath("/profil");

    return actionOk({ message: "Zaktualizowano pomiar.", reading: data });
  } catch (error) {
    logServerError("readings/update-unexpected", error);
    return actionError("Nie udało się zaktualizować pomiaru.");
  }
}

export async function updateReadingDirect(formData: FormData): Promise<void> {
  await updateReadingAction(null, formData);
}

export async function deleteReadingAction(
  _prevState: ActionResult<ReadingMessageData> | null,
  formData: FormData
): Promise<ActionResult<ReadingMessageData>> {
  const parsed = deleteReadingSchema.safeParse({
    id: getFormValue(formData, "id"),
  });

  if (!parsed.success) {
    return actionError(getValidationMessage(parsed.error.issues));
  }

  try {
    const { supabase, userId } = await getAuthenticatedUserId();

    if (!userId) {
      return actionError("Sesja wygasła. Zaloguj się ponownie.");
    }

    const { error } = await supabase
      .from("blood_pressure_readings")
      .delete()
      .eq("id", parsed.data.id)
      .eq("user_id", userId);

    if (error) {
      logServerError("readings/delete", error, { userId, readingId: parsed.data.id });
      return actionError("Nie udało się usunąć pomiaru.");
    }

    revalidatePath("/");
    revalidatePath("/profil");

    return actionOk({ message: "Usunięto pomiar." });
  } catch (error) {
    logServerError("readings/delete-unexpected", error);
    return actionError("Nie udało się usunąć pomiaru.");
  }
}

export async function deleteReadingDirect(formData: FormData): Promise<void> {
  await deleteReadingAction(null, formData);
}
