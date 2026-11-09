import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ErrorNote, IconButton, Row, T, Tappable } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { relativeDay } from '@/lib/format';
import type { Conversation } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

/**
 * Past chats with Luma, in a sheet over the chat: open one, start a new one,
 * or delete one. Loads fresh each time it opens.
 */
export function ChatHistorySheet({
  visible,
  currentId,
  onClose,
  onOpen,
  onNew,
  onDeletedCurrent,
}: {
  visible: boolean;
  currentId: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDeletedCurrent: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    api<{ conversations: Conversation[] }>('/conversations')
      .then((r) => !cancelled && setItems(r.conversations.filter((x) => x.messageCount > 0 || x.id === currentId)))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [visible, currentId]);

  const remove = async (convo: Conversation) => {
    const ok = await confirm('Delete this chat?', 'It will be removed for good. Things Luma remembered stay in Memory until you delete them there.');
    if (!ok) return;
    setItems((list) => list?.filter((x) => x.id !== convo.id) ?? list);
    try {
      await api(`/conversations/${convo.id}`, { method: 'DELETE' });
      if (convo.id === currentId) onDeletedCurrent();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30,24,20,0.28)' }]} onPress={onClose} accessibilityLabel="Close chat history" />
        <Animated.View
          entering={SlideInDown.duration(320)}
          style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: '80%',
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.lg,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, marginBottom: space.md }} />
          <Row style={{ paddingHorizontal: space.xl, justifyContent: 'space-between', marginBottom: space.md }}>
            <T variant="heading">Your chats</T>
            <Button title="New chat" icon="plus" small onPress={onNew} />
          </Row>

          {error && (
            <View style={{ paddingHorizontal: space.xl, marginBottom: space.sm }}>
              <ErrorNote message={error} />
            </View>
          )}
          {!items && !error && <ActivityIndicator color={c.primary} style={{ marginVertical: space.xxl }} />}
          {items && items.length === 0 && (
            <T variant="body" color={c.inkSoft} center style={{ marginVertical: space.xxl, paddingHorizontal: space.xl }}>
              No chats yet. Whatever’s on your mind, Luma is ready.
            </T>
          )}

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.xs }}>
            {items?.map((convo, i) => {
              const current = convo.id === currentId;
              return (
                <Animated.View key={convo.id} entering={FadeIn.delay(i * 30)}>
                  <Row
                    gap={space.sm}
                    style={{
                      borderRadius: radius.lg,
                      backgroundColor: current ? c.primarySoft : 'transparent',
                      paddingLeft: space.md,
                    }}
                  >
                    <Tappable
                      onPress={() => onOpen(convo.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${convo.title ?? 'Chat'}${current ? ', open now' : ''}`}
                      style={{ flex: 1, paddingVertical: space.md }}
                      scaleTo={0.98}
                    >
                      <Row style={{ justifyContent: 'space-between' }} gap={space.sm}>
                        <T variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }} color={current ? c.primary : c.ink}>
                          {convo.messageCount === 0 ? 'New chat' : (convo.title ?? 'Chat')}
                        </T>
                        <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
                          {current ? 'Open now' : relativeDay(convo.updatedAt)}
                        </T>
                      </Row>
                      {convo.preview && (
                        <T variant="small" color={c.inkSoft} numberOfLines={1} style={{ marginTop: 2 }}>
                          {convo.preview}
                        </T>
                      )}
                    </Tappable>
                    {convo.messageCount > 0 && (
                      <IconButton icon="trash-2" label={`Delete ${convo.title ?? 'chat'}`} tone="clear" size={36} onPress={() => remove(convo)} />
                    )}
                  </Row>
                </Animated.View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
