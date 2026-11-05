import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { api, errorMessage } from './api';

/**
 * Loads `path` when the screen gains focus (so data is fresh after returning
 * from another screen) and exposes reload/setData for optimistic updates.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const ticket = ++latest.current;
    setError(null);
    try {
      const result = await api<T>(path);
      if (ticket === latest.current) setData(result);
    } catch (e) {
      if (ticket === latest.current) setError(errorMessage(e));
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, error, loading, reload, setData };
}
