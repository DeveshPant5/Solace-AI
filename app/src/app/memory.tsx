import { Feather } from '@expo/vector-icons';
import { Switch, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { PipTip } from '@/components/PipTip';
import { Sol } from '@/components/Sol';
import { Button, Card, EmptyState, ErrorNote, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { relativeDay } from '@/lib/format';
import type { Memory } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { radius, space, useTheme } from '@/theme';

const CATEGORY_LABELS: Record<string, string> = {
  people: 'People',
  events: 'Coming up',
  goals: 'Goals',
  preferences: 'Preferences',
  challenges: 'Challenges',
  what_helps: 'What helps',
  other: 'Other',
};

export default function MemoryScreen() {
  const c = useTheme();
  const { user, updateUser } = useAuth();
  const { data, error, reload, setData } = useApi<{ memories: Memory[] }>('/memories');
  const enabled = user?.preferences.memoryEnabled !== false;

  const remove = async (m: Memory) => {
    setData((d) => (d ? { memories: d.memories.filter((x) => x.id !== m.id) } : d));
    await api(`/memories/${m.id}`, { method: 'DELETE' }).catch(() => reload());
  };

  const forgetAll = async () => {
    if (!(await confirm('Forget everything?', 'Luma will forget everything listed here. Your conversations stay unless you delete them.', 'Forget all'))) return;
    setData({ memories: [] });
    await api('/memories', { method: 'DELETE' }).catch(() => reload());
  };

  return (
    <Screen>
      <Header title="What Luma remembers" />
      <PipTip id="memory" />
      <Card style={{ gap: space.md }}>
        <Row gap={space.md}>
          <Sol size={56} mood={enabled ? 'happy' : 'sleepy'} animated={false} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">Let Luma remember</T>
            <T variant="small" color={c.inkSoft}>
              Luma keeps short notes about what matters to you, so you don’t have to repeat yourself.
            </T>
          </View>
          <Switch
            value={enabled}
            onValueChange={(value) => void updateUser({ preferences: { memoryEnabled: value } })}
            trackColor={{ true: c.primary, false: c.line }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Let Luma remember"
          />
        </Row>
        {!enabled && (
          <T variant="small" color={c.inkSoft}>
            Memory is off. Luma won’t save new notes or use past conversations, check-in notes or journal entries in new chats.
          </T>
        )}
      </Card>

      {error && !data && (
        <View style={{ marginTop: space.lg }}>
          <ErrorNote message={error} onRetry={reload} />
        </View>
      )}
      {data && data.memories.length === 0 && (
        <EmptyState icon="bookmark" title="Nothing saved yet" body="As you talk, Luma will note things like important people, upcoming events and what helps you." />
      )}

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {data?.memories.map((m) => (
          <Animated.View key={m.id} exiting={FadeOut} layout={LinearTransition}>
            <Row gap={space.md} style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg, alignItems: 'flex-start' }}>
              <Feather name="bookmark" size={16} color={c.primary} style={{ marginTop: 3 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="body">{m.content}</T>
                <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
                  {CATEGORY_LABELS[m.category] ?? 'Other'} · {relativeDay(m.createdAt)}
                </T>
              </View>
              <IconButton icon="x" label="Forget this" tone="clear" size={32} onPress={() => remove(m)} />
            </Row>
          </Animated.View>
        ))}
      </View>

      {data && data.memories.length > 0 && <Button title="Forget everything" kind="danger" onPress={forgetAll} style={{ marginTop: space.xl }} />}
    </Screen>
  );
}
