-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  merchant TEXT NOT NULL,
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'ordered',
  total_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  category TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  order_date TIMESTAMPTZ NOT NULL,
  expected_delivery TIMESTAMPTZ,
  delivered_date TIMESTAMPTZ,
  return_deadline TIMESTAMPTZ,
  invoice_url TEXT,
  payment_method TEXT,
  email_message_id TEXT UNIQUE, -- prevent duplicate processing
  raw_email_snippet TEXT,       -- store original email for debugging
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products within an order
CREATE TABLE order_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price NUMERIC,
  image_url TEXT
);

-- Timeline events for each order
CREATE TABLE order_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Track Gmail sync state
CREATE TABLE gmail_sync_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_history_id TEXT,          -- Gmail History API cursor
  last_synced_at TIMESTAMPTZ,
  total_emails_processed INTEGER DEFAULT 0
);

-- Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_sync_state ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users see own orders" ON orders
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own products" ON order_products
  FOR ALL USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));
CREATE POLICY "Users see own timeline" ON order_timeline
  FOR ALL USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));
CREATE POLICY "Users see own sync state" ON gmail_sync_state
  FOR ALL USING (auth.uid() = user_id);

-- Google OAuth refresh token so the sync-gmail function can renew Gmail access
-- (run this on existing databases too)
ALTER TABLE gmail_sync_state ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

-- Emails already judged "not an order", so later syncs skip them without asking the AI again
CREATE TABLE IF NOT EXISTS skipped_emails (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_message_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, email_message_id)
);
ALTER TABLE skipped_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own skipped emails" ON skipped_emails
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- One-time cleanup (run once in the SQL editor after deploying the order-merging sync-gmail).
-- Older syncs saved "order placed", "shipped" and "delivered" emails as separate orders. This
-- keeps the earliest row per order number, gives it the furthest status reached, and deletes the
-- copies. Their emails are remembered as "merged" so the next sync doesn't re-read them.
-- ---------------------------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    user_id,
    email_message_id,
    first_value(id) OVER w AS keep_id,
    row_number() OVER w AS rn
  FROM orders
  WHERE length(regexp_replace(coalesce(order_id, ''), '[#\s]', '', 'g')) >= 5
  WINDOW w AS (
    PARTITION BY user_id, upper(regexp_replace(order_id, '[#\s]', '', 'g'))
    ORDER BY order_date, created_at
  )
),
dupes AS (SELECT * FROM ranked WHERE rn > 1),
best AS (
  SELECT
    r.keep_id,
    (array_agg(o.status ORDER BY array_position(
      ARRAY['ordered','packed','shipped','out_for_delivery','delivered','cancelled','refunded'],
      o.status
    ) DESC NULLS LAST))[1] AS status,
    max(o.total_amount) AS total_amount,
    max(o.tracking_number) AS tracking_number,
    max(o.expected_delivery) AS expected_delivery
  FROM ranked r
  JOIN orders o ON o.id = r.id
  WHERE r.keep_id IN (SELECT keep_id FROM dupes)
  GROUP BY r.keep_id
),
updated AS (
  UPDATE orders o
  SET status = b.status,
      total_amount = b.total_amount,
      tracking_number = coalesce(o.tracking_number, b.tracking_number),
      expected_delivery = coalesce(o.expected_delivery, b.expected_delivery),
      updated_at = now()
  FROM best b
  WHERE o.id = b.keep_id
  RETURNING o.id
),
remembered AS (
  INSERT INTO skipped_emails (user_id, email_message_id, reason)
  SELECT user_id, email_message_id, 'merged' FROM dupes WHERE email_message_id IS NOT NULL
  ON CONFLICT (user_id, email_message_id) DO NOTHING
  RETURNING 1
)
DELETE FROM orders WHERE id IN (SELECT id FROM dupes);

-- Bank / card / UPI alerts saved as orders by older syncs. Preview first, then run the DELETE.
-- SELECT id, merchant, total_amount, split_part(raw_email_snippet, E'\n', 1) AS subject
-- FROM orders
-- WHERE split_part(raw_email_snippet, E'\n', 1) ~* '\m(debited|credited|transaction|txn|upi|a/c|statement|emi|wallet|recharge|autopay|mandate)\M'
--   AND split_part(raw_email_snippet, E'\n', 1) !~* '\m(order|shipped|dispatched|delivered|refund|booking|booked|ticket)';
-- DELETE FROM orders
-- WHERE split_part(raw_email_snippet, E'\n', 1) ~* '\m(debited|credited|transaction|txn|upi|a/c|statement|emi|wallet|recharge|autopay|mandate)\M'
--   AND split_part(raw_email_snippet, E'\n', 1) !~* '\m(order|shipped|dispatched|delivered|refund|booking|booked|ticket)';
