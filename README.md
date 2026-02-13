# Storm Repair Marketplace (Fixly)

Marketplace MVP for storm damage repair:
- Homeowners post damage photos with AI estimate support
- Contractors browse jobs and send itemized quotes in real-time chat
- Homeowners accept quotes and fund jobs
- Stripe Connect payout/release flow with platform commission

## Stack

- React + Vite + TypeScript + shadcn/ui
- Supabase (Auth, Postgres, Storage, Realtime, Edge Functions)
- Anthropic Claude (damage analysis)
- Stripe Connect (checkout + payout release)

## Local Setup

1. Install dependencies:

```sh
npm install
```

2. Create your environment file:

```sh
cp .env.example .env.local
```

3. Fill required frontend vars in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`

4. Run the app:

```sh
npm run dev
```

## Supabase Setup

Apply migrations:

```sh
supabase db push
```

Deploy edge functions:

```sh
supabase functions deploy analyze-damage
supabase functions deploy create-connect-onboarding
supabase functions deploy create-stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy release-job-payment
```

Set function secrets:

```sh
supabase secrets set ANTHROPIC_API_KEY=...
supabase secrets set STRIPE_SECRET_KEY=...
supabase secrets set STRIPE_WEBHOOK_SECRET=...
supabase secrets set APP_BASE_URL=http://localhost:8080
supabase secrets set PLATFORM_COMMISSION_RATE=0.12
```

## Key App Routes

- `/` landing
- `/auth` sign in/up
- `/onboarding/role` choose user or contractor
- `/app/user` user dashboard
- `/app/user/posts/new` create damage post
- `/app/user/posts/:postId` quote comparison, chat, payment/release, review
- `/app/contractor` contractor browsing dashboard
- `/app/contractor/posts/:postId` quote builder + chat + job status actions
