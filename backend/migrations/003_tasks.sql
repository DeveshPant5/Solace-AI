-- Daily tasks: things a person plans to do at a set time (calm breathing at 3 pm,
-- yoga before work), with a gentle reminder and a tick for today.
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- A practice in the app (opens it, and doing it ticks the task) or 'own' (yoga, a walk...).
  activity TEXT NOT NULL CHECK (activity IN ('breathe_calm', 'breathe_box', 'breathe_478', 'grounding', 'journal', 'checkin', 'own')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute SMALLINT NOT NULL CHECK (minute BETWEEN 0 AND 59),
  -- Which days it repeats on: bit 0 is Sunday ... bit 6 is Saturday (127 = every day).
  days SMALLINT NOT NULL DEFAULT 127 CHECK (days BETWEEN 1 AND 127),
  -- A timer length for the person's own tasks, in minutes.
  minutes SMALLINT CHECK (minutes BETWEEN 1 AND 180),
  remind BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_user ON tasks (user_id, hour, minute);

-- One row per task per day it was ticked off (the day is in the person's time zone).
CREATE TABLE task_completions (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, day)
);
CREATE INDEX task_completions_user_day ON task_completions (user_id, day);
