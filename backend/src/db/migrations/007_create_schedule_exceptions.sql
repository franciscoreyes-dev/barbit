CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id  UUID REFERENCES barbers(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  is_off     BOOLEAN DEFAULT false,
  start_time TIME,
  end_time   TIME,
  reason     VARCHAR(255),
  UNIQUE (barber_id, date)
);
