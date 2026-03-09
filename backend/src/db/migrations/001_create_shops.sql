CREATE TABLE IF NOT EXISTS shops (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(100) NOT NULL,
  slug      VARCHAR(100) UNIQUE NOT NULL,
  address   TEXT,
  city      VARCHAR(100),
  phone     VARCHAR(20),
  email     VARCHAR(255),
  timezone  VARCHAR(50) DEFAULT 'Europe/Rome',
  created_at TIMESTAMPTZ DEFAULT now()
);
