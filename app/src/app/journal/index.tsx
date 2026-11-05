import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Button, Card, EmptyState, ErrorNote, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import type { JournalEntry } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { space, useTheme } from '@/theme';

export default function JournalList() {
  const c = useTheme();
  const { data, error, reload, setData } = useApi<{ entries: JournalEntry[] }>('/journal');

  const remove = async (entry: JournalEntry) => {
    if (!(await confirm('Delete this entry?', 'This can’t be undone.'))) return;
    setData((d) => (d ? { entries: d.entries.filter((e) => e.id !== entry.id) } : d));
    await api(`/journal/${entry.id}`, { method: 'DELETE' }).catch(() => reload());
  };

  return (
    <Screen>
      <Header title="Your journal" right={<IconButton icon="plus" label="New entry" tone="primary" size={40} onPress={() => router.push('/journal/new')} />} />
      {error && !data && <ErrorNote message={error} onRetry={reload} />}
      {data && data.entries.length === 0 && (
        <EmptyState icon="feather" title="Your journal is empty" body="A few honest sentences can untangle a whole day.">
          <Button title="Write your first entry" small onPress={() => router.push('/journal/new')} />
        </EmptyState>
      )}
      <View style={{ gap: space.md }}>
        {data?.entries.map((entry, i) => (
          <Animated.View key={entry.id} entering={FadeInDown.delay(i * 40)} layout={LinearTransition}>
            <Card style={{ gap: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="caption" color={c.inkSoft}>
                  {new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </T>
                <IconButton icon="trash-2" label="Delete entry" tone="clear" size={32} onPress={() => remove(entry)} />
              </Row>
              {entry.prompt && (
                <T variant="small" color={c.primary}>
                  {entry.prompt}
                </T>
              )}
              <T variant="body">{entry.content}</T>
            </Card>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}
