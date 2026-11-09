import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { PipTip } from '@/components/PipTip';
import { Sol } from '@/components/Sol';
import { Button, Card, EmptyState, ErrorNote, IconButton, Row, Screen, SectionTitle, T, Tappable } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { relativeDay } from '@/lib/format';
import type { Conversation } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { radius, space, useTheme } from '@/theme';

const STARTERS = [
  { text: 'I’m feeling anxious', icon: 'cloud' as const },
  { text: 'I need to vent about my day', icon: 'wind' as const },
  { text: 'Help me wind down for sleep', icon: 'moon' as const },
  { text: 'I want to feel more motivated', icon: 'sunrise' as const },
];

export default function SolTab() {
  const c = useTheme();
  const { user } = useAuth();
  const { data, error, reload, setData } = useApi<{ conversations: Conversation[] }>('/conversations');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const start = async (starter?: string) => {
    setStarting(true);
    setStartError(null);
    try {
      const { conversation } = await api<{ conversation: Conversation }>('/conversations', { method: 'POST' });
      router.push({ pathname: '/chat/[id]', params: { id: conversation.id, ...(starter ? { starter } : {}) } });
    } catch (e) {
      setStartError(errorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  const remove = async (convo: Conversation) => {
    const ok = await confirm('Delete this conversation?', 'It will be removed for good. Things Sol remembered stay in Memory until you delete them there.');
    if (!ok) return;
    setData((d) => (d ? { conversations: d.conversations.filter((x) => x.id !== convo.id) } : d));
    try {
      await api(`/conversations/${convo.id}`, { method: 'DELETE' });
    } catch {
      void reload();
    }
  };

  const conversations = (data?.conversations ?? []).filter((x) => x.messageCount > 0);

  return (
    <Screen tabBar>
      <PipTip id="sol" style={{ marginTop: space.md, marginBottom: 0 }} />
      <View style={{ alignItems: 'center', marginTop: space.lg }}>
        <Sol size={150} mood="happy" />
        <T variant="title" center style={{ marginTop: space.md }}>
          Hi{user?.name ? ` ${user.name}` : ''}, I’m Sol
        </T>
        <T variant="body" color={c.inkSoft} center style={{ marginTop: space.sm, maxWidth: 320 }}>
          I’m here to listen, whenever you need me.
        </T>
        <Button title="Start a conversation" icon="message-circle" onPress={() => start()} loading={starting} style={{ marginTop: space.xl, alignSelf: 'stretch' }} />
      </View>
      {startError && (
        <View style={{ marginTop: space.md }}>
          <ErrorNote message={startError} />
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
        {STARTERS.map((s) => (
          <Tappable
            key={s.text}
            onPress={() => start(s.text)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <Feather name={s.icon} size={14} color={c.primary} />
            <T variant="small">{s.text}</T>
          </Tappable>
        ))}
      </View>

      <SectionTitle title="Your conversations" />
      {error && !data && <ErrorNote message={error} onRetry={reload} />}
      {data && conversations.length === 0 && (
        <EmptyState icon="message-square" title="No conversations yet" body="Whatever’s on your mind, big or small, Sol is ready when you are." />
      )}
      <View style={{ gap: space.sm }}>
        {conversations.map((convo, i) => (
          <Animated.View key={convo.id} entering={FadeInDown.delay(i * 40)} layout={LinearTransition}>
            <Card onPress={() => router.push(`/chat/${convo.id}`)} style={{ padding: space.lg }}>
              <Row gap={space.md}>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                      {convo.title ?? 'Conversation'}
                    </T>
                    <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
                      {relativeDay(convo.updatedAt)}
                    </T>
                  </Row>
                  {convo.preview && (
                    <T variant="small" color={c.inkSoft} numberOfLines={2} style={{ marginTop: 2 }}>
                      {convo.preview}
                    </T>
                  )}
                </View>
                <IconButton icon="trash-2" label="Delete conversation" tone="clear" size={36} onPress={() => remove(convo)} />
              </Row>
            </Card>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}
