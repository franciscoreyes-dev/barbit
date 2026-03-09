CREATE TABLE IF NOT EXISTS barbers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  shop_id    UUID REFERENCES shops(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
