CREATE TABLE IF NOT EXISTS barber_services (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id          UUID REFERENCES barbers(id) ON DELETE CASCADE,
  service_catalog_id UUID REFERENCES service_catalog(id),
  name               VARCHAR(100) NOT NULL,
  duration_minutes   INTEGER NOT NULL,
  price              NUMERIC(10,2),
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON barber_services (barber_id);
