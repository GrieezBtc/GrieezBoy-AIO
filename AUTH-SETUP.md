# Accounts, free trial and premium — setup

## How it works
- No account: Video Hub (watch only) + Snapchat + Threads. Other platforms show a lock.
- Account: starts with 10 coins. Every successful download costs 1 coin. Failed lookups are free.
- Out of coins: a popup sends them to WhatsApp / Telegram to buy more coins or go premium.
- Premium: unlimited, no coins spent. You switch it on by hand (below).
- If the two Supabase variables are missing, the site behaves exactly as before.

## 1. Create the Supabase project (free)
1. supabase.com -> New project.
2. SQL Editor -> New query -> paste all of `supabase/schema.sql` -> Run.
3. Authentication -> Providers -> Email: on.
   (Optional) Authentication -> Sign In / Providers -> turn OFF "Confirm email" so people can use the site right after signing up.

## 2. Add the keys to Vercel
Supabase -> Project Settings -> API Keys: copy the Project URL and the publishable key (older projects call it the anon key).
Vercel -> your project -> Settings -> Environment Variables (Production + Preview):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
Then redeploy.

## 3. After someone pays you
Supabase -> Table Editor -> `profiles` -> find their email:
- add coins: edit the `coins` number (e.g. 10 -> 60)
- premium: set `premium_until` to a future date (clear it to remove premium)

## Coins (run `supabase/coins.sql` once, after schema.sql)
Run it BEFORE deploying the coin update, otherwise the site cannot read balances.

## Change the numbers
- Starter coins: `default 10` in `supabase/coins.sql` (only affects new accounts) and `WELCOME_COINS` in `src/lib/access.ts`.
- Free platforms for guests: `GUEST_PLATFORMS` in `src/lib/access.ts`.
- WhatsApp / Telegram: `src/lib/contact.ts`.
