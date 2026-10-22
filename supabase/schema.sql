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
