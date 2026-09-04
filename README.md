# JOJOKEV Marketplace

A Jumia/Temu-style multi-vendor marketplace with escrow wallets, for Nigeria.
Next.js 14 (App Router, TypeScript) + Supabase (PostgreSQL, Auth, Storage) + TransactPay.

## Money flow

```
Buyer checks out ₦20,000 (₦18,800 goods + ₦1,200 delivery)
        │
        ▼
TransactPay issues a UNIQUE account number, valid 30 minutes
        │
        ▼
Buyer transfers the exact amount from their bank app
        │
        ▼
TransactPay fires a payment.success webhook to our server
        │
        ├─ commission 5% of ₦18,800 = ₦940 ──────→ platform revenue
        ├─ delivery fee ₦1,200 ──────────────────→ platform revenue
        │
        └─ ₦17,860 ──→ seller wallet: HOLD BALANCE  (not withdrawable)
                              │
                    seller marks order delivered
                              │
                    buyer confirms receipt
                    OR 2 days pass with no response
                              │
                              ▼
                    AVAILABLE BALANCE (withdrawable)
                              │
                    seller requests withdrawal
                    admin approves → TransactPay payout
                    (minus ₦100 fee) ──────────────→ seller's bank account
```

## Two architectural rules that must not be broken

**Rule 1 — Money moves only inside database transactions.**
Never read a balance into JavaScript, add to it, and write it back. Every balance
change goes through a PostgreSQL function (`supabase/03_escrow.sql`) that locks the row.

**Rule 2 — The browser is never trusted with prices.**
Order totals, commission, and stock are always recalculated on the server from
database values. The cart in the browser holds product IDs and quantities only.

## Setup

### 1. Supabase
1. Create a project at supabase.com (region closest to Nigeria, e.g. eu-west-1).
2. SQL Editor → run in order: `supabase/01_schema.sql`, `supabase/02_policies.sql`, `supabase/03_escrow.sql`.
3. Storage → create a public bucket named `product-images`.
4. Copy the URL, anon key, and service-role key from Project Settings → API.

### 2. Environment
Copy `.env.example` to `.env.local` and fill in every value.

### 3. Run locally
```bash
pnpm install
pnpm dev
```

### 4. First admin
Register normally, then run once in the SQL editor:
```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = 'your@email.com');
```

### 5. TransactPay
1. Sign up, complete business verification, take the **sandbox** keys first.
2. Set the webhook URL to `https://your-domain.com/api/webhooks/transactpay`
   and copy the webhook secret into `TRANSACTPAY_WEBHOOK_SECRET`.
3. Run one sandbox transfer. **Log the raw webhook body and headers**, then
   adjust `verifySignature` (app/api/webhooks/transactpay/route.ts) and
   `extractVirtualAccount` (lib/transactpay.ts) to match reality.
4. Only swap in live keys once the full test checklist passes.

### 6. Deploy
Push to GitHub, import the repo on Vercel, add every environment variable, deploy.
`vercel.json` already registers the hourly `/api/cron/auto-release` cron — set
`CRON_SECRET` in the environment and Vercel attaches it automatically.

### 7. Money integrity check — run after every test run
```sql
select w.id, w.seller_id,
       w.hold_balance_kobo + w.available_balance_kobo as wallet_total,
       coalesce(sum(t.amount_kobo), 0) as ledger_total
from wallets w
left join wallet_transactions t on t.wallet_id = w.id
group by w.id
having w.hold_balance_kobo + w.available_balance_kobo <> coalesce(sum(t.amount_kobo), 0);
-- must return ZERO rows
```

## Project layout

| Path | Purpose |
|---|---|
| `supabase/01_schema.sql` | All tables, triggers, seed categories |
| `supabase/02_policies.sql` | Row Level Security |
| `supabase/03_escrow.sql` | Escrow engine (settle, release, withdraw, auto-release) |
| `lib/supabase/clients.ts` | Browser / server / admin Supabase clients |
| `lib/money.ts` | Kobo ↔ naira helpers, commission calc |
| `lib/settings.ts` | Platform settings with toggles applied |
| `lib/transactpay.ts` | TransactPay API client |
| `lib/cart.ts` | localStorage cart (IDs + quantities only) |
| `app/actions/*` | Server actions (auth, products, cart, orders, escrow, admin) |
| `app/api/checkout/[orderId]` | Issue virtual account |
| `app/api/webhooks/transactpay` | Payment webhook (signature-verified, idempotent) |
| `app/api/orders/[orderId]/status` | Status polling fallback |
| `app/api/cron/auto-release` | Hourly escrow auto-release |
