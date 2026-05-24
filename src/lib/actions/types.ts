export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export const actionOk = <T>(data?: T): ActionResult<T> => {
  if (typeof data === "undefined") {
    return { success: true };
  }

  return { success: true, data };
};

export const actionError = (error: string): ActionResult<never> => ({
  success: false,
  error,
});
