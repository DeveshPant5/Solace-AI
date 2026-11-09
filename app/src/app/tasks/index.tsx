import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { HandIconTile } from '@/components/HandIcon';
import { PipTip } from '@/components/PipTip';
import { TaskRow } from '@/components/TaskBits';
import { Button, Card, ErrorNote, Header, IconButton, Row, Screen, SectionTitle, T, Tappable } from '@/components/ui';
import { useTaskToggle } from '@/lib/useTaskToggle';
import { formatTime } from '@/lib/format';
import { taskLook } from '@/lib/tasks';
import type { TaskActivity, TasksData } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { accent, space, useTheme } from '@/theme';

/** One-tap starting points for an empty list; each opens the editor filled in. */
const IDEAS: { activity: TaskActivity; title: string; hour: number; minute: number; minutes?: number }[] = [
  { activity: 'breathe_calm', title: 'Calm breathing', hour: 15, minute: 0 },
  { activity: 'own', title: 'Yoga', hour: 7, minute: 0, minutes: 20 },
  { activity: 'journal', title: 'Journal', hour: 21, minute: 30 },
];

const openEditor = (params: Record<string, string> = {}) => router.push({ pathname: '/tasks/edit', params });

export default function Tasks() {
  const c = useTheme();
  const { data, error, reload, setData } = useApi<TasksData>('/tasks');
  const { toggle, toggleError } = useTaskToggle(setData);
  const today = data?.tasks.filter((t) => t.dueToday) ?? [];
  const later = data?.tasks.filter((t) => !t.dueToday) ?? [];

  return (
    <Screen>
      <Header title="Daily tasks" right={<IconButton icon="plus" label="Add a task" onPress={() => openEditor()} />} />
      <PipTip id="tasks" />

      {(error || toggleError) && (
        <View style={{ marginTop: space.md }}>
          <ErrorNote message={(toggleError ?? error)!} onRetry={error ? reload : undefined} />
        </View>
      )}

      {data && data.tasks.length === 0 && (
        <Animated.View entering={FadeInDown}>
          <Card style={{ marginTop: space.lg, alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
            <HandIconTile name="sprout" size={64} bg={c.sageSoft} fg={c.sage} />
            <T variant="heading" center>
              Nothing planned yet
            </T>
            <Button title="Plan a task" icon="plus" small onPress={() => openEditor()} />
          </Card>
          <SectionTitle title="Some ideas" />
          <View style={{ gap: space.sm }}>
            {IDEAS.map((idea) => {
              const look = taskLook(idea);
              const a = accent(c, look.accent);
              return (
                <Tappable
                  key={idea.title}
                  accessibilityRole="button"
                  onPress={() =>
                    openEditor({
                      activity: idea.activity,
                      title: idea.title,
                      hour: String(idea.hour),
                      minute: String(idea.minute),
                      ...(idea.minutes ? { minutes: String(idea.minutes) } : {}),
                    })
                  }
                >
                  <Card style={{ paddingVertical: space.md }}>
                    <Row gap={space.md}>
                      <HandIconTile name={look.icon} size={40} bg={a.soft} fg={a.strong} />
                      <T variant="bodyStrong" style={{ flex: 1 }}>
                        {idea.title}
                      </T>
                      <T variant="small" color={c.inkSoft}>
                        {formatTime(idea.hour, idea.minute)}
                      </T>
                    </Row>
                  </Card>
                </Tappable>
              );
            })}
          </View>
        </Animated.View>
      )}

      {today.length > 0 && (
        <>
          <SectionTitle title="Today" />
          <Card style={{ paddingVertical: space.sm }}>
            {today.map((t, i) => (
              <Animated.View key={t.id} entering={FadeInDown.delay(i * 40)} layout={LinearTransition}>
                <TaskRow task={t} onPress={() => openEditor({ id: t.id })} onToggle={() => toggle(t)} />
              </Animated.View>
            ))}
          </Card>
        </>
      )}

      {later.length > 0 && (
        <>
          <SectionTitle title="Other days" />
          <Card style={{ paddingVertical: space.sm }}>
            {later.map((t) => (
              <TaskRow key={t.id} task={t} onPress={() => openEditor({ id: t.id })} chevron />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
