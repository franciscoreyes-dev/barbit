CREATE TABLE IF NOT EXISTS service_catalog (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     VARCHAR(100) NOT NULL,
  default_duration_minutes INTEGER NOT NULL,
  category                 VARCHAR(50)
);
