import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { ActivityCard } from '@/components/ActivityCard';
import { PipTip } from '@/components/PipTip';
import { moodToExpression, Sol } from '@/components/Sol';
import { Button, Card, Chip, ErrorNote, Header, inputStyle, Pill, Row, Screen, T, Tappable } from '@/components/ui';
import { EMOTIONS } from '@/content/wellness';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import type { ActivityId } from '@/lib/types';
import { accent, MOODS, radius, space, useTheme } from '@/theme';

interface CheckinResponse {
  xp: number;
  reply: { message: string; activity: ActivityId };
}

export default function Checkin() {
  const c = useTheme();
  const params = useLocalSearchParams<{ mood?: string }>();
  const initial = Number(params.mood);
  const [mood, setMood] = useState<number | null>(initial >= 1 && initial <= 5 ? initial : null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResponse | null>(null);

  const emotionList = mood && mood <= 3 ? [...EMOTIONS.low, ...EMOTIONS.high] : [...EMOTIONS.high, ...EMOTIONS.low];
  const toggle = (e: string) => setEmotions((list) => (list.includes(e) ? list.filter((x) => x !== e) : list.length >= 5 ? list : [...list, e]));

  const save = async () => {
    if (!mood) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<CheckinResponse>('/moods', { body: { mood, emotions, note: note.trim() || undefined } });
      haptic.success();
      setResult(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Screen>
        <Header title="Check-in saved" />
        <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center', marginTop: space.lg }}>
          <Sol size={150} mood={moodToExpression(mood)} tint={mood ?? 0} />
          <Animated.View entering={FadeIn.delay(300)}>
            <Pill text={`+${result.xp} XP`} icon="star" bg={c.butterSoft} fg={c.ink} />
          </Animated.View>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(250)}>
          <Card style={{ marginTop: space.xl, gap: space.sm }}>
            <T variant="caption" color={c.primary}>
              Sol says
            </T>
            <T variant="body">{result.reply.message}</T>
          </Card>
          {result.reply.activity !== 'none' && (
            <View style={{ marginTop: space.lg }}>
              <ActivityCard activity={result.reply.activity} />
            </View>
          )}
        </Animated.View>
        <Button title="Done" onPress={() => router.back()} style={{ marginTop: space.xxl }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Check in" />
      <PipTip id="checkin" />
      <View style={{ alignItems: 'center' }}>
        <Sol size={140} mood={mood ? moodToExpression(mood) : 'listening'} tint={mood ?? 0} />
        <T variant="title" center style={{ marginTop: space.md }}>
          {mood ? MOODS[mood - 1]!.label : 'How are you, really?'}
        </T>
        <T variant="small" color={c.inkSoft} center style={{ marginTop: 4 }}>
          There’s no wrong answer.
        </T>
      </View>

      <Row style={{ justifyContent: 'space-between', marginTop: space.xl }}>
        {MOODS.map((m) => {
          const a = accent(c, m.accent);
          const active = mood === m.value;
          return (
            <Tappable
              key={m.value}
              onPress={() => {
                haptic.soft();
                setMood(m.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={m.label}
              style={{
                width: 58,
                height: 58,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? a.strong : a.soft,
                transform: [{ scale: active ? 1.08 : 1 }],
              }}
            >
              <Sol size={46} mood={moodToExpression(m.value)} tint={m.value} animated={false} />
            </Tappable>
          );
        })}
      </Row>

      {mood && (
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: space.xxl, gap: space.md }}>
          <T variant="subheading">What’s behind it?</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {emotionList.map((e) => (
              <Chip key={e} label={e} selected={emotions.includes(e)} onPress={() => toggle(e)} />
            ))}
          </View>
          <T variant="subheading" style={{ marginTop: space.md }}>
            Anything you want to add?
          </T>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="A few words about your day (optional)"
            placeholderTextColor={c.inkFaint}
            style={[inputStyle(c), { minHeight: 90, textAlignVertical: 'top', borderRadius: radius.md }]}
            multiline
            maxLength={1000}
          />
          {error && <ErrorNote message={error} />}
          <Button title="Save check-in" onPress={save} loading={busy} style={{ marginTop: space.sm }} />
        </Animated.View>
      )}
    </Screen>
  );
}
