import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { PipTip } from '@/components/PipTip';
import { Sol } from '@/components/Sol';
import { Button, Card, ErrorNote, Header, Pill, Row, Screen, T, Tappable } from '@/components/ui';
import { JOURNAL_PROMPTS } from '@/content/wellness';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { radius, space, type, useTheme } from '@/theme';

export default function NewJournalEntry() {
  const c = useTheme();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const [promptIndex, setPromptIndex] = useState(() => new Date().getDate() % JOURNAL_PROMPTS.length);
  const [customPrompt, setCustomPrompt] = useState(params.prompt ?? null);
  const [usePrompt, setUsePrompt] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ xp: number } | null>(null);

  const prompt = customPrompt ?? JOURNAL_PROMPTS[promptIndex]!;

  const save = async () => {
    if (!text.trim()) return setError('Write a few words first.');
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ xp: number }>('/journal', { body: { prompt: usePrompt ? prompt : undefined, content: text.trim() } });
      haptic.success();
      setSaved({ xp: r.xp });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <Screen scroll={false} contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <Animated.View entering={ZoomIn}>
          <Sol size={140} mood="joyful" />
        </Animated.View>
        <T variant="title" center>
          Saved to your journal
        </T>
        <T variant="body" color={c.inkSoft} center style={{ maxWidth: 300 }}>
          Putting thoughts into words is a quiet kind of strength.
        </T>
        <Pill text={`+${saved.xp} XP`} icon="star" bg={c.butterSoft} fg={c.ink} />
        <Button title="Done" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: space.xl }} />
        <Button title="See all entries" kind="ghost" onPress={() => router.replace('/journal')} style={{ alignSelf: 'stretch' }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Journal" />
      <PipTip id="journal" />
      {usePrompt ? (
        <Animated.View entering={FadeIn} key={prompt}>
          <Card tone={c.butterSoft} style={{ gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="caption" color={c.inkSoft}>
                {customPrompt ? 'A prompt from Sol' : 'Today’s prompt'}
              </T>
              <Row gap={space.md}>
                <Tappable
                  onPress={() => {
                    setCustomPrompt(null);
                    setPromptIndex((i) => (i + 1) % JOURNAL_PROMPTS.length);
                  }}
                  accessibilityLabel="Another prompt"
                  hitSlop={8}
                >
                  <Feather name="refresh-cw" size={16} color={c.inkSoft} />
                </Tappable>
                <Tappable onPress={() => setUsePrompt(false)} accessibilityLabel="Write without a prompt" hitSlop={8}>
                  <Feather name="x" size={18} color={c.inkSoft} />
                </Tappable>
              </Row>
            </Row>
            <T variant="heading">{prompt}</T>
          </Card>
        </Animated.View>
      ) : (
        <Tappable onPress={() => setUsePrompt(true)} style={{ alignSelf: 'flex-start' }}>
          <Row gap={6}>
            <Feather name="zap" size={14} color={c.primary} />
            <T variant="small" color={c.primary}>
              Use a prompt
            </T>
          </Row>
        </Tappable>
      )}

      <View style={{ marginTop: space.lg, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, minHeight: 260 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Start writing. No one else will read this."
          placeholderTextColor={c.inkFaint}
          multiline
          autoFocus
          maxLength={10000}
          style={{ flex: 1, minHeight: 230, color: c.ink, fontFamily: type.body.fontFamily, fontSize: 17, lineHeight: 26, textAlignVertical: 'top' }}
        />
      </View>
      <T variant="small" color={c.inkFaint} style={{ marginTop: space.sm, textAlign: 'right' }}>
        {text.trim() ? `${text.trim().split(/\s+/).length} words` : ''}
      </T>
      {error && <ErrorNote message={error} />}
      <Button title="Save entry" onPress={save} loading={busy} style={{ marginTop: space.lg }} />
    </Screen>
  );
}
