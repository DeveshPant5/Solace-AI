import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button, Card, EmptyState, Header, Pill, ProgressBar, Row, Screen, T, Tappable } from '@/components/ui';
import { activityHref, activityInfo } from '@/content/activities';
import { GUIDES } from '@/content/guides';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { accent, radius, space, useTheme } from '@/theme';

export default function GuideScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = GUIDES[id ?? ''];
  const [done, setDone] = useState<number[]>([]);
  const [xpEarned, setXpEarned] = useState(0);

  useEffect(() => {
    api<{ done: Record<string, number[]> }>('/activities/guides')
      .then((r) => setDone(r.done[id ?? ''] ?? []))
      .catch(() => undefined);
  }, [id]);

  if (!guide) {
    return (
      <Screen>
        <Header />
        <EmptyState icon="book" title="Guide not found" />
      </Screen>
    );
  }
  const a = accent(c, guide.accent);

  const mark = async (step: number) => {
    if (done.includes(step)) return;
    haptic.success();
    setDone((d) => [...d, step]);
    try {
      const r = await api<{ xp: number }>('/activities', { body: { kind: 'guide_step', meta: { guide: guide.id, step } } });
      setXpEarned((x) => x + r.xp);
    } catch {
      // keep the local tick even if offline
    }
  };

  return (
    <Screen>
      <Header />
      <Card tone={a.soft} style={{ gap: space.sm }}>
        <T variant="caption" color={c.inkSoft}>
          {guide.eyebrow}
        </T>
        <T variant="title">{guide.title}</T>
        <T variant="body" color={c.inkSoft}>
          {guide.intro}
        </T>
        <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
          <T variant="small" color={c.inkSoft}>
            {done.length}/{guide.steps.length} steps · +5 XP each
          </T>
          {xpEarned > 0 && (
            <Animated.View entering={ZoomIn}>
              <Pill text={`+${xpEarned} XP`} icon="star" bg={c.surface} fg={c.ink} />
            </Animated.View>
          )}
        </Row>
        <ProgressBar value={done.length / guide.steps.length} color={a.strong} track={c.surface} />
      </Card>

      <T variant="caption" color={c.inkSoft} style={{ marginTop: space.xxl, marginBottom: space.md }}>
        Tap each one as you try it
      </T>
      <View style={{ gap: space.md }}>
        {guide.steps.map((step, i) => {
          const isDone = done.includes(i);
          const linked = activityInfo(step.activity);
          return (
            <Animated.View key={step.title} entering={FadeInDown.delay(i * 80)}>
              <Tappable
                onPress={() => mark(i)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                style={{
                  backgroundColor: isDone ? a.soft : c.surface,
                  borderRadius: radius.lg,
                  padding: space.lg,
                  borderWidth: 1,
                  borderColor: isDone ? a.strong : c.line,
                  gap: space.sm,
                }}
              >
                <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: isDone ? a.strong : a.soft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isDone ? <Feather name="check" size={16} color="#FFFFFF" /> : <T variant="bodyStrong">{i + 1}</T>}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="subheading">{step.title}</T>
                    <T variant="small" color={c.inkSoft}>
                      {step.body}
                    </T>
                    {linked && step.activity && (
                      <Tappable onPress={() => router.push(activityHref(step.activity!))} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                        <Row gap={6}>
                          <Feather name={linked.icon} size={14} color={c.primary} />
                          <T variant="small" color={c.primary}>
                            Try {linked.title.toLowerCase()}
                          </T>
                        </Row>
                      </Tappable>
                    )}
                  </View>
                </Row>
              </Tappable>
            </Animated.View>
          );
        })}
      </View>

      <Card style={{ marginTop: space.xxl, gap: space.md }}>
        <T variant="body">{guide.closing}</T>
        <Row gap={space.sm}>
          <Button title="Talk to Sol" icon="message-circle" small onPress={() => router.push('/sol')} style={{ flex: 1 }} />
          <Button title="Get support" icon="life-buoy" kind="secondary" small onPress={() => router.push('/help')} style={{ flex: 1 }} />
        </Row>
      </Card>
    </Screen>
  );
}
