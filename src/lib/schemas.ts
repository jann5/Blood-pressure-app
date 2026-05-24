import { z } from "zod";

const emailSchema = z
  .string()
  .min(1, "Email jest wymagany.")
  .trim()
  .email("Podaj poprawny adres email.")
  .toLowerCase();

const passwordSchema = z
  .string()
  .min(1, "Hasło jest wymagane.")
  .min(8, "Hasło musi mieć co najmniej 8 znaków.")
  .max(128, "Hasło jest za długie.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Hasło jest wymagane."),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Powtórz hasło."),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Powtórz hasło."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Hasła nie są takie same.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Podaj obecne hasło."),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, "Powtórz nowe hasło."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Nowe hasła nie są takie same.",
    path: ["confirmNewPassword"],
  });

export const readingSchema = z.object({
  systolic: z.coerce.number().int("Wartość musi być liczbą całkowitą.").min(60, "Skurczowe musi być >= 60.").max(280, "Skurczowe musi być <= 280."),
  diastolic: z.coerce
    .number()
    .int("Wartość musi być liczbą całkowitą.")
    .min(30, "Rozkurczowe musi być >= 30.")
    .max(180, "Rozkurczowe musi być <= 180."),
  pulse: z.coerce.number().int("Wartość musi być liczbą całkowitą.").min(30, "Puls musi być >= 30.").max(240, "Puls musi być <= 240."),
  measuredAt: z
    .string()
    .min(1, "Data pomiaru jest wymagana.")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Podaj poprawną datę pomiaru."),
  note: z
    .string()
    .trim()
    .max(500, "Notatka może mieć maksymalnie 500 znaków.")
    .optional()
    .transform((value) => value || null),
});

export const updateReadingSchema = readingSchema.extend({
  id: z.string().uuid("Nieprawidłowe ID pomiaru."),
});

export const deleteReadingSchema = z.object({
  id: z.string().uuid("Nieprawidłowe ID pomiaru."),
});
