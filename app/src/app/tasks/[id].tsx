import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { HandIconTile } from '@/components/HandIcon';
import { Button, ErrorNote, Header, IconButton, Pill, T } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { cancelTimerEnd, scheduleTimerEnd, skipTodaysTaskReminders } from '@/lib/notifications';
import { taskLook } from '@/lib/tasks';
import type { TaskItem, TasksData } from '@/lib/types';
import { accent, fonts, space, useTheme } from '@/theme';

const RING = 248;
const STROKE = 9;
const R = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** One of the person's own tasks: a calm timer if it has one, and a way to mark it done. */
export default function TaskScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = (task?.minutes ?? 0) * 60_000;
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [finished, setFinished] = useState<{ xp: number } | null>(null);
  const running = endAt !== null;
  const runningRef = useRef(false);
  runningRef.current = running;

  const load = useCallback(() => {
    setError(null);
    api<TasksData>('/tasks')
      .then(({ tasks }) => {
        const t = tasks.find((x) => x.id === id);
        if (!t) return setError('That task isn’t here any more.');
        setTask(t);
        setLeft((t.minutes ?? 0) * 60_000);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(load, [load]);

  // Leaving the screen stops the timer and its "time's up" notification.
  useEffect(
    () => () => {
      if (runningRef.current) void cancelTimerEnd();
    },
    [],
  );

  const markDone = useCallback(async () => {
    haptic.success();
    let xp = 0;
    try {
      xp = (await api<{ xp: number }>(`/tasks/${id}/done`, { body: { done: true } })).xp;
      void skipTodaysTaskReminders([id]);
    } catch {
      // Offline: the moment still counts, it just isn't recorded.
    }
    setFinished({ xp });
  }, [id]);

  // Counts from the end time, so it stays right after the phone sleeps or the app is in the background.
  useEffect(() => {
    if (endAt === null) return;
    const tick = setInterval(() => {
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        clearInterval(tick);
        setEndAt(null);
        setLeft(0);
        void cancelTimerEnd();
        void markDone();
      } else {
        setLeft(remaining);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [endAt, markDone]);

  const start = () => {
    if (!task?.minutes) return;
    const at = Date.now() + left;
    haptic.soft();
    setEndAt(at);
    void scheduleTimerEnd(task.title, task.minutes, new Date(at), `/tasks/${id}`);
  };

  const pause = () => {
    if (endAt === null) return;
    setLeft(Math.max(0, endAt - Date.now()));
    setEndAt(null);
    void cancelTimerEnd();
  };

  const again = () => {
    setFinished(null);
    setLeft(total);
  };

  const look = task ? taskLook(task) : null;
  const a = look ? accent(c, look.accent) : null;
  const progress = total > 0 ? left / total : 0;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={c.scheme === 'dark' ? ['#1F2A24', '#221F1D', c.bg] : ['#E4EFE4', '#F1F0E8', c.bg]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xl }}>
        <Header
          title={task?.title ?? ''}
          right={
            task && !running ? (
              <IconButton icon="edit-2" label="Edit task" onPress={() => router.push({ pathname: '/tasks/edit', params: { id } })} />
            ) : undefined
          }
        />

        {error && <ErrorNote message={error} onRetry={load} />}
        {!task && !error && <ActivityIndicator color={c.primary} style={{ marginTop: space.xxxl }} />}

        {task && look && a && (
          <>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {finished ? (
                <Animated.View entering={ZoomIn} style={{ alignItems: 'center', gap: space.md }}>
                  <HandIconTile name={look.icon} size={96} bg={a.soft} fg={a.strong} />
                  <T variant="title">Nicely done</T>
                  {finished.xp > 0 && <Pill text={`+${finished.xp} XP`} icon="star" bg={c.butterSoft} fg={c.ink} />}
                </Animated.View>
              ) : task.minutes ? (
                <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
                    <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={c.scheme === 'dark' ? '#2E3A33' : '#D7E6D9'} strokeWidth={STROKE} fill="none" />
                    <Circle
                      cx={RING / 2}
                      cy={RING / 2}
                      r={R}
                      stroke={c.primary}
                      strokeWidth={STROKE}
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                      transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                    />
                  </Svg>
                  <HandIconTile name={look.icon} size={48} bg={a.soft} fg={a.strong} />
                  <Text style={[styles.clock, { color: c.ink }]} accessibilityLabel={`${clock(left)} left`}>
                    {clock(left)}
                  </Text>
                  <T variant="small" color={c.inkSoft}>
                    {running ? 'Take your time' : `${task.minutes} minutes`}
                  </T>
                </View>
              ) : (
                <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: space.lg }}>
                  <HandIconTile name={look.icon} size={120} bg={a.soft} fg={a.strong} />
                  <T variant="quote" color={c.inkSoft} center>
                    Whenever you’re ready
                  </T>
                </Animated.View>
              )}
            </View>

            {task.doneToday && !finished && !running && (
              <T variant="small" color={c.primary} center style={{ marginBottom: space.md }}>
                Done for today
              </T>
            )}

            {finished ? (
              <View style={{ gap: space.sm }}>
                <Button title="Done" onPress={() => router.back()} />
                {!!task.minutes && <Button title="Go again" kind="ghost" onPress={again} />}
              </View>
            ) : task.minutes ? (
              <View style={{ gap: space.sm }}>
                {running ? (
                  <Button title="Pause" kind="secondary" icon="pause" onPress={pause} />
                ) : (
                  <Button title={left < total ? 'Resume' : 'Begin'} icon="play" onPress={start} />
                )}
                <Button
                  title="I’m done"
                  kind="ghost"
                  onPress={() => {
                    pause();
                    void markDone();
                  }}
                />
              </View>
            ) : (
              <Button title="Mark as done" icon="check" onPress={() => void markDone()} />
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clock: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60, marginTop: space.sm, fontVariant: ['tabular-nums'] },
});
