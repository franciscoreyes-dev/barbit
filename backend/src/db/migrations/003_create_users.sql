CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'barber')),
  shop_id       UUID REFERENCES shops(id) ON DELETE CASCADE,
  is_active     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
