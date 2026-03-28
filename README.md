This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Architecture (high level)

- App Router routes live under `src/app` (e.g. `src/app/dashboard/*`).
- Auth and data come from Supabase (`src/lib/supabase/*`) with route protection via `src/middleware.ts`.
- Global state uses Zustand (`src/stores/*`) and currency conversion uses exchange rates (`src/lib/exchange-rates.ts`).
- UI uses Tailwind CSS and Shadcn/Radix primitives (`src/components/ui/*`), plus Recharts for charts.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Features

- Vaults “Recent Activity” supports incremental pagination via “Ver más movimientos”.
- Expenses dashboard is available at `/dashboard/expenses` with category aggregation, charts and filters.
- Categories admin is available at `/dashboard/settings/categories`.
- User exchange rate can be persisted via `/api/exchange-rate` (USD↔EUR) and managed in Preferences.

## Supabase

- SQL schema for required tables and RLS policies: `supabase/schema.sql`
- After applying SQL, reload the PostgREST schema cache in Supabase: Settings → API → Reload schema

## Tests

```bash
pnpm test
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
