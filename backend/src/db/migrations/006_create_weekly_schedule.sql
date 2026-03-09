CREATE TABLE IF NOT EXISTS weekly_schedule (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   UUID REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_working  BOOLEAN DEFAULT true,
  UNIQUE (barber_id, day_of_week)
);
