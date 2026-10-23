# Haul (inbox-chronicle)

Haul turns your Gmail inbox into one clean dashboard of all your online orders.
Sign in with Google, click **Sync Now**, and Haul finds order / receipt / shipping emails
from Amazon, Flipkart, Swiggy, Zomato, Myntra and others, uses Google Gemini AI to read them,
and shows every order — merchant, items, amount, status, tracking — in one place.

> A detailed beginner-friendly technical guide is available in
> [`docs/OrderHub-Technical-Guide.pdf`](docs/OrderHub-Technical-Guide.pdf) (written before the rename to Haul).

---

## Features

- **Sign in with Google** (Supabase Auth + Google OAuth, read-only Gmail permission)
- **Gmail sync** — finds order-related emails and extracts structured order data with Gemini AI
- **Dashboard** — active orders, deliveries this month, monthly spend, open return windows
- **Orders list** with platform / status filters, and an **order detail** page with products and timeline
- **Analytics** — spend by platform and category charts
- **Dark / light theme**, responsive layout with mobile navigation
- **Landing page** at `/` with Google sign-in; signed-in users go straight to `/dashboard`

## Tech stack

| Layer | Technology | Used for |
| --- | --- | --- |
| UI | React 19, TypeScript | Components and pages |
| Framework | TanStack Start + TanStack Router | File-based routing, server-side rendering |
| Data fetching | TanStack Query | Loading/caching orders, auth session |
| Styling | Tailwind CSS 4, Radix UI (shadcn/ui), lucide-react | Design system, accessible components, icons |
| Charts | Recharts | Analytics page |
| Build tool | Vite 8 | Dev server and production build |
| Hosting target | Nitro → Vercel | Server runtime for the built app |
| Auth | Supabase Auth with Google OAuth | Login + Gmail read permission |
| Database | Supabase Postgres + Row Level Security | Orders, products, timeline, sync state |
| Backend | Supabase Edge Function `sync-gmail` (Deno) | Gmail fetching, AI parsing, saving orders |
| AI | Google Gemini API (`gemini-3.8-flash` by default) | Turning email text into order JSON |
| External API | Gmail API (`gmail.readonly`) | Listing and reading order emails |

## How it works (short version)

```
Browser (React app)
  │ 1. "Sign in with Google"  ──►  Supabase Auth  ──►  Google consent (gmail.readonly)
  │ 2. Google refresh token saved to gmail_sync_state
  │ 3. "Sync Now"  ──►  POST /functions/v1/sync-gmail  (batches of 4 emails)
  ▼
Supabase Edge Function: sync-gmail
  ├─ verify the user's Supabase JWT
  ├─ get a Gmail access token (from the browser, or refreshed with the stored refresh token)
  ├─ Gmail API: search order emails, download each one
  ├─ clean the email into plain text
  ├─ Gemini: "extract order JSON from this email"
  └─ upsert into orders + order_products (Postgres)
  ▼
Browser re-fetches orders (TanStack Query) and the dashboard updates
```

## Project structure

```
src/
  routes/            Pages (file-based routing): index, orders, orders.$id, analytics, search, settings, login
  components/        App components (header, sidebar, order card, timeline…) and components/ui (shadcn/ui)
  hooks/             use-auth, use-orders, use-theme, use-mobile
  services/          auth.ts (Google sign-in), orders.ts (DB queries + snake_case → camelCase mapping)
  lib/               supabase.ts (client + Google token capture), mock-data.ts, format.ts, error handling
  types/order.ts     Order / Product / TimelineEvent types
  server.ts, start.ts  SSR entry and error middleware
supabase/
  schema.sql                     Database tables + Row Level Security policies
  functions/sync-gmail/index.ts  The Gmail → Gemini → database sync function
```

## Running locally

### Prerequisites

- Node.js 20+ and npm (or Bun)
- A [Supabase](https://supabase.com) project
- A Google Cloud project with an OAuth client (Web application)
- A [Gemini API key](https://aistudio.google.com/apikey)

### 1. Install and configure

```bash
npm install
```

Create a `.env` file in the project root (never commit it):

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Both values are required — sign-in and sync need Supabase.

### 2. Start the dev server

```bash
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:8080`).

### 3. Set up the backend (one time)

1. **Database** — in Supabase → SQL Editor, run `supabase/schema.sql`.
2. **Google Cloud** —
   - enable the **Gmail API**;
   - on the OAuth consent screen add the scope `https://www.googleapis.com/auth/gmail.readonly`
     and (while in Testing) add your Gmail address as a test user;
   - add `https://<your-project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. **Supabase Auth** — Authentication → Providers → Google: paste the Client ID and Secret.
   Under URL Configuration set the **Site URL** to your live address (`https://haul-umber.vercel.app`) and add
   `https://haul-umber.vercel.app/**` and `http://localhost:8080/**` to **Redirect URLs**.
4. **Edge function secrets and deploy**

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase secrets set GEMINI_API_KEY=... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
   # optional: npx supabase secrets set GEMINI_MODEL=<model-name>
   npx supabase functions deploy sync-gmail
   ```

5. In the app: **sign in with Google** (tick “Read your email messages”), open **Settings → Sync Now**.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build (Nitro, Vercel target) |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Deploying (Vercel)

Live at **https://haul-umber.vercel.app**. Vercel builds from `main` on every push.

- Environment variables in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- The edge function deploys separately: `npx supabase functions deploy sync-gmail`.
- Google sign-in returns to Supabase, which sends users back to the site — so the live URL must be in
  Supabase → Authentication → URL Configuration (see step 3 above). No change is needed in Google Cloud.

## Troubleshooting

| Message | Cause / fix |
| --- | --- |
| `Request had insufficient authentication scopes` | Gmail permission not granted. Remove the app at myaccount.google.com/permissions, sign in again and tick the Gmail box. Check the scope is on the consent screen. |
| `Google access expired and no refresh token is stored` | Sign out and sign in again (Google only sends the refresh token at sign-in). |
| `GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET secrets are not set` | Set them with `npx supabase secrets set`. |
| `Gemini API error … model … no longer available` | Set a current model: `npx supabase secrets set GEMINI_MODEL=<name>`. |
| `WORKER_RESOURCE_LIMIT` / `Request idle timeout` | Edge function CPU/time limits. Batches are already small (4 emails); click Sync again — already-synced emails are skipped. |
| “N email(s) postponed (Gemini busy)” | Gemini was overloaded; click Sync again later. |
| Host `*.supabase.co` doesn't resolve | Supabase project is paused — restore it in the dashboard. |

## Known limitations

- Each click scans up to ~100 of the newest matching emails; older history isn't reached yet.
- Gmail search covers the Purchases and Reservations tabs plus subject keywords (order, receipt, invoice, purchase, shipped, delivery, booking); order emails outside both can still be missed.
- “Ordered”, “Shipped” and “Delivered” emails for the same order are stored as separate orders; the order timeline isn't filled yet.
- The Search page and the “Automatic sync” toggle still use placeholder behaviour.
