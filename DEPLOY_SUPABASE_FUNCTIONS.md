# Deploy the Shreyanvi order-management functions

The website files are hosted on GitHub Pages. The two TypeScript files in this folder are **not automatically deployed** by GitHub Pages; they must be deployed as Supabase Edge Functions.

## 1. Deploy admin-api
1. Open https://supabase.com/dashboard/project/hlkuewtgwjgywxstzbex/functions
2. Choose **Deploy new function** → **Via Editor**.
3. Name it exactly: `admin-api`.
4. Open `supabase/functions/admin-api/index.ts` in this repository and copy the complete file into the editor.
5. Keep **Verify JWT** enabled, then deploy.

## 2. Deploy public-track
Repeat the same steps with function name `public-track`, using `supabase/functions/public-track/index.ts`.
For this public tracking function, turn **Verify JWT OFF**. The tracking token is a random 256-bit secret and the function returns only order progress and item details, not customer contact information.

## 3. Function secrets
The functions use Supabase's default environment variables:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEYS`
- `SUPABASE_SECRET_KEYS`

Supabase normally provides these automatically to hosted Edge Functions. The code also supports the legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` variables. Never put a secret/service-role key in this GitHub repository or in browser JavaScript.

## 4. Test
1. Open the website admin page and sign in.
2. The dashboard should load the order register and counts.
3. Create a test order with a test phone number you control.
4. Open the generated tracking link in a private/incognito tab.
5. Update the test order status in admin and refresh the tracking page.
6. Delete or cancel the test order after testing if appropriate.

The existing tables and columns are expected to match the Shreyanvi schema already created in Supabase: `orders`, `order_items`, and `order_status_history`. If a function reports a missing column/table, stop and inspect the actual schema rather than adding guessed columns.
