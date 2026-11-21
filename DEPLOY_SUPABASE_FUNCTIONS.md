# Deploy the Shreeyanvi order-management functions

The website files are hosted on GitHub Pages. The TypeScript files in this folder must be deployed as Supabase Edge Functions; GitHub Pages does not deploy them.

## 1. Deploy admin-check
1. Open https://supabase.com/dashboard/project/hlkuewtgwjgywxstzbex/functions
2. Choose **Deploy new function** → **Via Editor**.
3. Name it exactly: `admin-check`.
4. Copy the complete file from `supabase/functions/admin-check/index.ts`.
5. Keep **Verify JWT ON**, then deploy.

## 2. Deploy admin-api
Repeat the steps above with function name `admin-api`, using `supabase/functions/admin-api/index.ts`.
Keep **Verify JWT ON**.

## 3. Deploy public-track
Repeat with function name `public-track`, using `supabase/functions/public-track/index.ts`.
Set **Verify JWT OFF**. This endpoint validates a random 256-bit tracking token itself and returns order progress and item details only.

## 4. Function environment
The functions use Supabase's injected environment values:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEYS`
- `SUPABASE_SECRET_KEYS`

The admin and tracking functions use elevated access only inside Edge Functions. Never copy a secret/service-role key into this repository or browser JavaScript. The browser publishable key is intentionally public and must be protected by RLS, table grants, and server-side authorization.

## 5. Test
1. Open the website admin page and sign in.
2. Confirm the dashboard loads the order register and counts.
3. Create a test order using a test phone number you control.
4. Open its tracking link in a private/incognito tab.
5. Change the order status in admin and refresh the tracking page.
6. Confirm the timeline updates, then cancel or remove the test order if appropriate.

The functions expect the existing Shreeyanvi tables: `orders`, `order_items`, and `order_status_history`. Inspect the actual schema before changing columns if a function reports a missing table or field.
