# Let's ride

React + TypeScript + Vite + Tailwind dashboard to upload GPX routes, view route stats, and sync routes across devices using Supabase.

## 1. Install

```bash
npm install
```

## 2. Configure Supabase

1. Create a project in [Supabase](https://supabase.com).
2. In Supabase SQL Editor, run `SUPABASE_SETUP.sql` (this now also creates groups/memberships/auth profile tables, seeds default groups, and creates the `ride-photos` bucket + policies).
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

## 4. New member flow

1. Create an account (email + password).
2. Search existing groups.
3. Open groups: direct join.
4. Closed groups: send request and wait for admin approval.
5. Admins can approve/reject member requests from `Ledenaanvragen` inside the hamburger menu of that group.

## 5. Deploy on Vercel (with Supabase)

1. Push this project to GitHub.
2. In Vercel: `Add New -> Project` and select the repo.
3. In Vercel project settings, add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
4. Deploy.

Vercel config is already included in `vercel.json`.

## 6. Build

```bash
npm run build
```
