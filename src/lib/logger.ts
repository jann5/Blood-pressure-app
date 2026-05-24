export const logServerError = (
  scope: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void => {
  const payload = {
    scope,
    metadata,
    error,
    timestamp: new Date().toISOString(),
  };

  console.error("[server-error]", payload);
};
