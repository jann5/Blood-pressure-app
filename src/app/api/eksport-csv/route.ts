import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/logger";

const escapeCsv = (value: string | number | null): string => {
  if (value === null) {
    return "";
  }

  const str = String(value).replaceAll('"', '""');
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str}"`;
  }

  return str;
};

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response("Brak autoryzacji", { status: 401 });
    }

    const { data, error } = await supabase
      .from("blood_pressure_readings")
      .select("id,systolic,diastolic,pulse,note,measured_at,created_at")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: false });

    if (error) {
      logServerError("export-csv/query", error, { userId: user.id });
      return new Response("Nie udało się przygotować eksportu", { status: 500 });
    }

    const header = [
      "id",
      "skurczowe",
      "rozkurczowe",
      "puls",
      "notatka",
      "data_pomiaru",
      "data_dodania",
    ].join(",");

    const lines = data.map((row) =>
      [
        escapeCsv(row.id),
        escapeCsv(row.systolic),
        escapeCsv(row.diastolic),
        escapeCsv(row.pulse),
        escapeCsv(row.note),
        escapeCsv(row.measured_at),
        escapeCsv(row.created_at),
      ].join(",")
    );

    const csv = [header, ...lines].join("\n");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(csv));
        controller.close();
      },
    });

    const filename = `pomiary-cisnienia-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("export-csv/unexpected", error);
    return new Response("Nie udało się przygotować eksportu", { status: 500 });
  }
}
