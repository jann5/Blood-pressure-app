type SupabaseLikeError = {
  code?: string;
  message?: string;
};

const errorCodeMap: Record<string, string> = {
  email_not_confirmed: "Potwierdź adres email, aby się zalogować.",
  invalid_credentials: "Nieprawidłowy email lub hasło.",
  invalid_login_credentials: "Nieprawidłowy email lub hasło.",
  user_already_exists: "Konto z tym emailem już istnieje.",
  weak_password: "Hasło jest zbyt słabe.",
  over_request_rate_limit: "Zbyt wiele prób. Spróbuj ponownie za chwilę.",
  signup_disabled: "Rejestracja jest chwilowo niedostępna.",
  reauthentication_needed: "Wymagana jest ponowna weryfikacja tożsamości.",
  same_password: "Nowe hasło musi różnić się od obecnego.",
};

export const mapAuthErrorToPolish = (
  error: SupabaseLikeError | null | undefined,
  fallback = "Wystąpił błąd. Spróbuj ponownie."
): string => {
  if (!error) {
    return fallback;
  }

  if (error.code && errorCodeMap[error.code]) {
    return errorCodeMap[error.code];
  }

  const message = (error.message ?? "").toLowerCase();

  if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
    return "Nieprawidłowy email lub hasło.";
  }

  if (message.includes("email not confirmed")) {
    return "Potwierdź adres email, aby się zalogować.";
  }

  if (message.includes("user already registered") || message.includes("already registered")) {
    return "Konto z tym emailem już istnieje.";
  }

  if (message.includes("password should be at least") || message.includes("weak password")) {
    return "Hasło jest zbyt słabe.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "Nie udało się połączyć z serwerem. Spróbuj ponownie.";
  }

  return fallback;
};
