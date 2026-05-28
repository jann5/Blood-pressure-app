# Ciśnieniomierz

Aplikacja web do monitorowania ciśnienia i pulsu z historią, analityką i eksportem danych.

## Live

- Produkcja: https://blood-pressure-app-three.vercel.app

## Co potrafi

- Logowanie / rejestracja użytkownika.
- Dodawanie pomiarów: skurczowe, rozkurczowe, puls, data, notatka.
- Dashboard z aktualnym statusem pomiaru.
- Historia pomiarów i usuwanie wpisów.
- Historia pomiarów w 2 trybach widoku: duże i małe kafelki.
- Wykres trendu (7d / 30d / 3m / all).
- Ustawienia progów klasyfikacji ciśnienia i pulsu.
- Codzienne przypomnienia push o pomiarze pulsu (PWA + godzina w ustawieniach).
- Eksport danych do JSON.
- Usuwanie konta użytkownika.

## Stack

- Frontend: React 19 + TypeScript + Vite
- UI: Tailwind CSS 4, Framer Motion, Recharts, Radix
- Backend: Convex (`@convex-dev/auth`)
- Email: Resend
- Hosting: Vercel

## Uruchomienie lokalne

```bash
npm install
npx convex dev
npm run dev
```

Domyślny frontend działa na `http://localhost:5173`.

## Environment variables

Uzupełnij `.env.local` (przykład w `.env.example`):

```env
VITE_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
VITE_WEB_PUSH_PUBLIC_KEY=your-public-vapid-key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
```

Dodatkowo ustaw na środowisku Convex:

- `RESEND_API_KEY`
- `FROM_EMAIL` (opcjonalnie)
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` (np. `mailto:admin@example.com`)

Klucze VAPID wygenerujesz komendą:

```bash
npx web-push generate-vapid-keys
```

## Skrypty

- `npm run dev` - dev server Vite
- `npm run build` - build produkcyjny
- `npm run preview` - podgląd buildu
- `npm run convex:dev` - Convex dev
- `npm run convex:deploy` - deploy Convex

## Deploy na Vercel

Repo jest przypięte do Vite:

- `vercel.json` wymusza `framework: vite` i `outputDirectory: dist`
- `.vercelignore` blokuje przypadkowe wrzutki starego middleware

Deploy:

```bash
vercel build --prod --yes
vercel deploy --prebuilt --prod --yes
```

## Struktura

```text
src/
  App.tsx
  main.tsx
  components/ui/
  lib/
convex/
  schema.ts
  readings.ts
  preferences.ts
  account.ts
  auth.ts
```

## Uwaga

Aplikacja wspiera monitoring i nie zastępuje konsultacji lekarskiej.
