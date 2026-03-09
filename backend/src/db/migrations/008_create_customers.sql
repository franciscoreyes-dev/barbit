CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      VARCHAR(20) NOT NULL,
  name       VARCHAR(100),
  shop_id    UUID REFERENCES shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (phone, shop_id)
);
