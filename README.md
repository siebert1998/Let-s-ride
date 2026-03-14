# Let's ride

React + TypeScript + Vite + Tailwind dashboard to upload GPX routes, view route stats, and sync routes across devices using Supabase.

## 1. Install

```bash
npm install
```

## 2. Configure Supabase

1. Create a project in [Supabase](https://supabase.com).
2. In Supabase SQL Editor, run `SUPABASE_SETUP.sql` (this also adds history fields and creates the `ride-photos` storage bucket + policies).
3. Go to `Project Settings -> API` and copy:
   - `Project URL`
   - `anon public` key
4. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

5. Fill `.env`:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

## 3. Run locally

```bash
npm run dev
```

## 4. Deploy on Vercel (with Supabase)

1. Push this project to GitHub.
2. In Vercel: `Add New -> Project` and select the repo.
3. In Vercel project settings, add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
4. Deploy.

Vercel config is already included in `vercel.json`.

## 5. Build

```bash
npm run build
```
