import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityCard } from '@/components/ActivityCard';
import { MicButton } from '@/components/MicButton';
import { Sol } from '@/components/Sol';
import { TypingDots } from '@/components/TypingDots';
import { Button, ErrorNote, Header, IconButton, Row, T, Tappable } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { streamChat } from '@/lib/chatStream';
import { confirm } from '@/lib/confirm';
import { formatTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { syncReminders } from '@/lib/notifications';
import type { ChatMessage, ChatSignal, Suggestion } from '@/lib/types';
import { setSolVoice, speakAsSol, stopSpeaking, useSolVoice } from '@/lib/voice';
import { radius, shadow, space, type as typeScale, useTheme } from '@/theme';

const PENDING = 'pending-reply';

const PROMPTS = ['Something’s been on my mind…', 'Can you help me calm down?', 'I had a good day today', 'I don’t know how I feel'];

/** Renders **bold** spans; Sol mostly writes plain text. */
function RichText({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <T variant="body" color={color}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <T key={i} variant="bodyStrong" color={color}>
            {part.slice(2, -2)}
          </T>
        ) : (
          part
        ),
      )}
    </T>
  );
}

function SafetyCard({ level }: { level: 'concern' | 'crisis' }) {
  const c = useTheme();
  return (
    <Animated.View entering={FadeInUp} style={{ backgroundColor: c.roseSoft, borderRadius: radius.md, padding: space.lg, gap: space.sm, marginVertical: space.sm }}>
      <Row gap={8}>
        <Feather name="heart" size={16} color={c.danger} />
        <T variant="bodyStrong">{level === 'crisis' ? 'You don’t have to face this alone' : 'Support is here if you need it'}</T>
      </Row>
      <T variant="small" color={c.inkSoft}>
        {level === 'crisis'
          ? 'If you might act on these thoughts or you’re in danger, please contact a crisis line or emergency services now. Talking to someone can help.'
          : 'If things feel too heavy, a trained listener can help. Free, confidential support is a tap away.'}
      </T>
      <Button title="Get support now" icon="life-buoy" small kind={level === 'crisis' ? 'primary' : 'secondary'} onPress={() => router.push('/help')} style={{ alignSelf: 'flex-start' }} />
    </Animated.View>
  );
}

function Extras({ message }: { message: ChatMessage }) {
  const c = useTheme();
  const { suggestions, memories, reminders } = message.meta;
  if (!suggestions?.length && !memories?.length && !reminders?.length) return null;
  return (
    <View style={{ gap: space.sm, marginTop: space.sm, marginLeft: 44 }}>
      {suggestions?.map((s: Suggestion, i: number) => (
        <Animated.View key={`s${i}`} entering={FadeInUp}>
          <ActivityCard activity={s.activity} reason={s.reason} journalPrompt={s.journalPrompt} compact />
        </Animated.View>
      ))}
      {reminders?.map((r) => (
        <Animated.View key={r.id} entering={FadeIn}>
          <Tappable onPress={() => router.push('/reminders')}>
            <Row gap={6} style={{ alignSelf: 'flex-start', backgroundColor: c.butterSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill }}>
              <Feather name="bell" size={13} color={c.ink} />
              <T variant="small" style={{ fontSize: 13 }}>
                Reminder set: {r.title} · {formatTime(r.hour, r.minute)}
              </T>
            </Row>
          </Tappable>
        </Animated.View>
      ))}
      {memories?.length ? (
        <Animated.View entering={FadeIn}>
          <Tappable onPress={() => router.push('/memory')}>
            <Row gap={6} style={{ alignSelf: 'flex-start', backgroundColor: c.lavenderSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill }}>
              <Feather name="bookmark" size={13} color={c.primary} />
              <T variant="small" color={c.primary} style={{ fontSize: 13 }}>
                Sol will remember this
              </T>
            </Row>
          </Tappable>
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function Chat() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { id, starter } = useLocalSearchParams<{ id: string; starter?: string }>();
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  const startedWith = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const solVoice = useSolVoice();
  const dictationBase = useRef('');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api<{ conversation: { title: string | null }; messages: ChatMessage[] }>(`/conversations/${id}`);
      setTitle(r.conversation.title);
      setMessages(r.messages);
      setLoaded(true);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => {
      abort.current?.abort();
      stopSpeaking();
    };
  }, [load]);

  const patchPending = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((list) => list.map((m) => (m.id === PENDING ? fn(m) : m)));

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || sending) return;
      haptic.tap();
      setInput('');
      setError(null);
      setSending(true);
      const tempId = `local-${Date.now()}`;
      const now = new Date().toISOString();
      setMessages((list) => [
        ...list,
        { id: tempId, role: 'user', content, meta: {}, createdAt: now },
        { id: PENDING, role: 'assistant', content: '', meta: {}, createdAt: now },
      ]);
      const controller = new AbortController();
      abort.current = controller;
      let gotReply = false;
      let userMessageId = tempId;
      try {
        await streamChat(
          id,
          content,
          (event, data) => {
            switch (event) {
              case 'user':
                userMessageId = data.id;
                setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, id: data.id, createdAt: data.createdAt } : m)));
                break;
              case 'delta':
                gotReply = true;
                patchPending((m) => ({ ...m, content: m.content + data.text }));
                break;
              case 'replace':
                gotReply = true;
                patchPending((m) => ({ ...m, content: data.text }));
                break;
              case 'suggestion':
                patchPending((m) => ({ ...m, meta: { ...m.meta, suggestions: [...(m.meta.suggestions ?? []), data] } }));
                break;
              case 'memory':
                patchPending((m) => ({ ...m, meta: { ...m.meta, memories: [...(m.meta.memories ?? []), data] } }));
                break;
              case 'reminder':
                patchPending((m) => ({ ...m, meta: { ...m.meta, reminders: [...(m.meta.reminders ?? []), data] } }));
                void syncReminders();
                break;
              case 'signal': {
                const signal = data as ChatSignal;
                setMessages((list) =>
                  list.map((m) => (m.id === userMessageId || m.id === tempId ? { ...m, meta: { ...m.meta, signal } } : m)),
                );
                if (signal.risk !== 'none') haptic.warning();
                break;
              }
              case 'done':
                gotReply = true;
                setMessages((list) => list.map((m) => (m.id === PENDING ? (data.message as ChatMessage) : m)));
                haptic.soft();
                void speakAsSol((data.message as ChatMessage).content);
                break;
              case 'title':
                setTitle(data.title);
                break;
              case 'error':
                setError(data.message);
                break;
            }
          },
          controller.signal,
        );
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e));
      } finally {
        const unsent = userMessageId === tempId; // the server never stored it
        setMessages((list) =>
          list
            .filter((m) => !(m.id === PENDING && !m.content) && !(unsent && m.id === tempId))
            .map((m) => (m.id === PENDING ? { ...m, id: `reply-${Date.now()}` } : m)),
        );
        if (!gotReply) setInput((current) => current || content);
        setSending(false);
      }
    },
    [id, sending],
  );

  useEffect(() => {
    if (loaded && starter && !startedWith.current && messages.length === 0) {
      startedWith.current = true;
      void send(starter);
    }
  }, [loaded, starter, messages.length, send]);

  const remove = async () => {
    const ok = await confirm('Delete this conversation?', 'It will be removed for good.');
    if (!ok) return;
    try {
      await api(`/conversations/${id}`, { method: 'DELETE' });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const mine = item.role === 'user';
    const prev = messages[index - 1];
    const showAvatar = !mine && prev?.role !== 'assistant';
    const risk = mine ? item.meta.signal?.risk : undefined;
    return (
      <View style={{ marginTop: prev && prev.role !== item.role ? space.lg : space.xs }}>
        {mine ? (
          <Animated.View entering={FadeInUp.duration(250)} style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
            <View style={{ backgroundColor: c.primary, borderRadius: radius.lg, borderBottomRightRadius: 6, paddingHorizontal: space.lg, paddingVertical: space.md }}>
              <T variant="body" color={c.primaryInk}>
                {item.content}
              </T>
            </View>
          </Animated.View>
        ) : (
          <Row gap={space.sm} style={{ alignItems: 'flex-end' }}>
            <View style={{ width: 36 }}>{showAvatar && <Sol size={36} mood={item.id === PENDING && !item.content ? 'thinking' : 'happy'} animated={item.id === PENDING} />}</View>
            <View style={[{ maxWidth: '82%', backgroundColor: c.surface, borderRadius: radius.lg, borderBottomLeftRadius: 6, paddingHorizontal: space.lg, paddingVertical: space.md }, shadow(c, 1)]}>
              {item.content ? <RichText text={item.content} color={c.ink} /> : <TypingDots color={c.primary} />}
            </View>
          </Row>
        )}
        {!mine && <Extras message={item} />}
        {risk && risk !== 'none' && <SafetyCard level={risk} />}
      </View>
    );
  };

  const empty = loaded && messages.length === 0 && !sending;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl }}>
        <Header
          title={title ?? 'Sol'}
          right={
            <Row gap={space.xs}>
              <IconButton
                icon={solVoice ? 'volume-2' : 'volume-x'}
                label={solVoice ? 'Sol speaks replies. Tap to read only.' : 'Sol replies in text. Tap to hear Sol.'}
                tone="clear"
                onPress={() => void setSolVoice(!solVoice)}
              />
              {loaded && messages.length > 0 && <IconButton icon="trash-2" label="Delete conversation" tone="clear" onPress={remove} />}
            </Row>
          }
        />
      </View>
      {loadError ? (
        <View style={{ padding: space.xl }}>
          <ErrorNote message={loadError} onRetry={load} />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.lg, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            empty ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingTop: space.xxxl }}>
                <Sol size={120} mood="listening" />
                <T variant="heading" center>
                  What’s on your mind?
                </T>
                <T variant="small" color={c.inkSoft} center style={{ maxWidth: 280 }}>
                  Type anything. There’s no right way to start.
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center', marginTop: space.md }}>
                  {PROMPTS.map((p) => (
                    <Tappable key={p} onPress={() => send(p)} style={{ backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: c.line }}>
                      <T variant="small">{p}</T>
                    </Tappable>
                  ))}
                </View>
              </View>
            ) : undefined
          }
        />
      )}
      {error && (
        <View style={{ paddingHorizontal: space.xl, paddingBottom: space.sm }}>
          <ErrorNote message={error} />
        </View>
      )}
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.md), backgroundColor: c.bg }}>
        <Row gap={space.sm} style={[{ backgroundColor: c.surface, borderRadius: radius.xl, paddingLeft: space.lg, paddingRight: 6, paddingVertical: 6, alignItems: 'flex-end' }, shadow(c, 2)]}>
          <TextInput
            value={input}
            onChangeText={(v) => {
              stopSpeaking();
              setInput(v);
            }}
            placeholder="Message Sol…"
            placeholderTextColor={c.inkFaint}
            multiline
            maxLength={4000}
            style={{ flex: 1, color: c.ink, fontFamily: typeScale.body.fontFamily, fontSize: 16, maxHeight: 120, paddingVertical: 10 }}
            onSubmitEditing={Platform.OS === 'web' ? () => send(input) : undefined}
            submitBehavior={Platform.OS === 'web' ? 'submit' : undefined}
            accessibilityLabel="Message Sol"
          />
          <MicButton
            size={42}
            onListeningChange={(on) => {
              if (on) dictationBase.current = input.trim() ? `${input.trim()} ` : '';
            }}
            onText={(t) => setInput(`${dictationBase.current}${t}`.slice(0, 4000))}
          />
          <IconButton icon="arrow-up" label="Send" tone="primary" size={42} onPress={() => send(input)} />
        </Row>
        <T variant="small" color={c.inkFaint} center style={{ fontSize: 11, marginTop: 6 }}>
          Sol is an AI companion, not a therapist. In an emergency, call your local emergency number.
        </T>
      </View>
    </KeyboardAvoidingView>
  );
}
