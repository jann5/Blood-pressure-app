# Ciśnieniomierz (Blood Pressure App)

Nowoczesna aplikacja web do zapisywania pomiarów ciśnienia i pulsu, z historią, trendami i prostą analityką.

## Live

- Produkcja: [https://blood-pressure-app-three.vercel.app](https://blood-pressure-app-three.vercel.app)

## Najważniejsze funkcje

- Rejestracja i logowanie (email + hasło + kod potwierdzający email).
- Szybkie dodawanie pomiaru: skurczowe, rozkurczowe, puls, data/godzina, notatka.
- Dashboard z ostatnim pomiarem i statusem (norma / podwyższone / wysokie / niskie).
- Historia pomiarów z możliwością usuwania wpisów.
- Analityka trendu (7 dni, 30 dni, 3 miesiące, całość) na wykresie.
- Personalizacja progów klasyfikacji ciśnienia i pulsu.
- Eksport danych użytkownika do pliku JSON.
- Usuwanie konta wraz z danymi użytkownika.

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Recharts.
- Backend (aktywny tor): Convex + `@convex-dev/auth`.
- Email: Resend (wysyłka kodów potwierdzających).
- Deploy: Vercel (build Vite, output `dist`).

## Ważne: dwa tory w repo

Repo zawiera równolegle:

- aktywną wersję Vite + Convex (to jest wersja produkcyjna na Vercel),
- oraz rozpoczęty tor Next.js + Supabase (`src/app`, `middleware.ts`, `src/lib/supabase/*`).

Dlatego:

- `npm run dev` uruchamia Vite na `http://localhost:5173`,
- `npm run next:dev` uruchamia eksperymentalny tor Next na `http://localhost:3000`.

## Szybki start (Vite + Convex)

### 1) Instalacja

```bash
npm install
```

### 2) Konfiguracja `.env.local`

Minimalnie dla frontendu Vite:

```env
VITE_CONVEX_URL=https://<twoj-deployment>.convex.cloud
CONVEX_DEPLOYMENT=dev:<nazwa-deploymentu>
VITE_CONVEX_SITE_URL=https://<twoj-deployment>.convex.site
```

Przykładowy plik jest w repo: [`.env.local`](./.env.local).

### 3) Uruchom backend Convex

```bash
npx convex dev
```

### 4) Uruchom frontend

```bash
npm run dev
```

## Zmienne środowiskowe backendu (Convex)

Dla wysyłki kodów email ustaw w środowisku Convex:

- `RESEND_API_KEY` (wymagane do wysyłki emaili),
- `FROM_EMAIL` (opcjonalne, domyślnie `onboarding@resend.dev` / `Ciśnieniomierz <onboarding@resend.dev>`).

## Skrypty

- `npm run dev` - Vite dev server (`5173`).
- `npm run build` - build produkcyjny Vite.
- `npm run preview` - podgląd buildu lokalnie.
- `npm run convex:dev` - Convex dev.
- `npm run convex:deploy` - deploy funkcji Convex.
- `npm run next:dev` - tor Next.js (eksperymentalny).
- `npm run next:build` - build toru Next.js.
- `npm run next:start` - start toru Next.js.

## Deploy na Vercel

Projekt jest skonfigurowany pod Vite:

- [`vercel.json`](./vercel.json) ustawia `framework: "vite"` i `outputDirectory: "dist"`.
- [`.vercelignore`](./.vercelignore) wyklucza `middleware.ts`, żeby Vercel nie próbował budować edge middleware z toru Next.

Typowy flow:

```bash
vercel build --prod --yes
vercel deploy --prebuilt --prod --yes
```

## Troubleshooting

- Problem: `NEXT_PUBLIC_SUPABASE_URL` missing na localhost.
  - Przyczyna: uruchomiony tor Next (`npm run next:dev`), który wymaga env Supabase.
  - Rozwiązanie: do aktywnej appki używaj `npm run dev` (Vite + Convex).

- Problem: brak danych / brak logowania w Vite.
  - Sprawdź `VITE_CONVEX_URL` i czy działa `npx convex dev`.

## Struktura (skrót)

```text
src/
  App.tsx                    # główna aplikacja Vite
  main.tsx                   # entrypoint Vite + ConvexAuthProvider
  components/ui/             # komponenty UI
  lib/                       # helpery
convex/
  schema.ts                  # schema danych
  readings.ts                # CRUD pomiarów
  preferences.ts             # ustawienia progów
  account.ts                 # hasło/usuwanie konta
  auth.ts                    # konfiguracja auth + email verification
supabase/
  migrations/                # SQL dla toru Next+Supabase
```

## Uwaga medyczna

Aplikacja służy do monitorowania danych i nie zastępuje konsultacji lekarskiej.
