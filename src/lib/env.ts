const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Brak wymaganej zmiennej środowiskowej: ${key}`);
  }

  return value;
};

export const getSupabaseUrl = (): string => getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
export const getSupabaseAnonKey = (): string => getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const getSupabaseServiceRoleKey = (): string => getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

export const getAppUrl = (): string => {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
};
