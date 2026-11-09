import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { api, errorMessage } from './api';
import { haptic } from './haptics';
import { skipTodaysTaskReminders, syncReminders } from './notifications';
import type { TaskItem, TasksData } from './types';

/** Ticks a task on or off for today, straight away on screen, and keeps today's reminder in step. */
export function useTaskToggle(setData: Dispatch<SetStateAction<TasksData | null>>) {
  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggle = useCallback(
    async (task: TaskItem) => {
      // A practice done in the app stays done.
      if (task.doneVia === 'practice') return;
      const done = !task.doneToday;
      const show = (value: boolean) =>
        setData((d) =>
          d ? { ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, doneToday: value, doneVia: value ? 'tick' : null } : t)) } : d,
        );
      setToggleError(null);
      show(done);
      if (done) haptic.success();
      else haptic.tap();
      try {
        await api(`/tasks/${task.id}/done`, { body: { done } });
        if (done) void skipTodaysTaskReminders([task.id]);
        else void syncReminders().catch(() => undefined);
      } catch (e) {
        show(!done);
        setToggleError(errorMessage(e));
      }
    },
    [setData],
  );

  return { toggle, toggleError };
}
