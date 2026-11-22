# Accounts, free trial and premium — setup

## How it works
- No account: Video Hub + Snapchat + Threads only. Other platforms show a lock.
- Account: 7-day free trial, every platform, 3 links per day (resets at midnight Nigerian time).
- After the trial, or after 3 links in a day: a popup sends them to WhatsApp / Telegram to subscribe.
- Premium: unlimited. You switch it on by hand (below).
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

## 3. Give someone premium (after they pay you)
Supabase -> Table Editor -> `profiles` -> find their email -> set `premium_until` to a date
(e.g. 30 days from today). Clear it to remove premium. It works from the phone browser too.
To extend someone's free trial, edit `trial_ends_at` the same way.

## Change the numbers
- Daily limit: `v_limit` in `consume_download()` in schema.sql (re-run that function) and `DAILY_LIMIT` in `src/lib/access.ts`.
- Free platforms for guests: `GUEST_PLATFORMS` in `src/lib/access.ts`.
- WhatsApp / Telegram: `src/lib/contact.ts`.
