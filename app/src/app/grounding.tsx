import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PipTip } from '@/components/PipTip';
import { Sol } from '@/components/Sol';
import { Button, Header, Pill, ProgressBar, Row, T, Tappable } from '@/components/ui';
import { GROUNDING_STEPS } from '@/content/wellness';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';

export default function Grounding() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [found, setFound] = useState(0);
  const [done, setDone] = useState<{ xp: number } | null>(null);
  const current = GROUNDING_STEPS[step]!;

  const tapFound = async () => {
    haptic.soft();
    const next = found + 1;
    if (next < current.count) return setFound(next);
    if (step < GROUNDING_STEPS.length - 1) {
      setFound(0);
      setStep(step + 1);
      return;
    }
    haptic.success();
    let xp = 0;
    try {
      xp = (await api<{ xp: number }>('/activities', { body: { kind: 'grounding' } })).xp;
    } catch {
      // offline: skip XP
    }
    setDone({ xp });
  };

  const totalTaps = GROUNDING_STEPS.reduce((s, g) => s + g.count, 0);
  const progress = (GROUNDING_STEPS.slice(0, step).reduce((s, g) => s + g.count, 0) + found) / totalTaps;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={c.scheme === 'dark' ? ['#1E2B22', c.bg] : ['#DFEEDF', c.bg]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xl }}>
        <Header title="5-4-3-2-1 grounding" />
        <ProgressBar value={done ? 1 : progress} color={c.sage} track={c.sageSoft} />
        {!done && <PipTip id="grounding" style={{ marginTop: space.lg, marginBottom: 0 }} />}

        {done ? (
          <Animated.View entering={ZoomIn} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
            <Sol size={150} mood="calm" />
            <T variant="title" center>
              You’re here, right now
            </T>
            <T variant="body" color={c.inkSoft} center style={{ maxWidth: 300 }}>
              Notice how your body feels compared to a few minutes ago. You can come back to this any time.
            </T>
            {done.xp > 0 && <Pill text={`+${done.xp} XP`} icon="star" bg={c.butterSoft} fg={c.ink} />}
          </Animated.View>
        ) : (
          <Animated.View key={step} entering={FadeInRight.duration(400)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: c.sageSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={current.icon} size={54} color={c.sage} />
            </View>
            <T variant="hero" center>
              {current.count}
            </T>
            <T variant="heading" center style={{ maxWidth: 300 }}>
              {current.prompt}
            </T>
            <Row gap={10} style={{ marginTop: space.md }}>
              {Array.from({ length: current.count }).map((_, i) => (
                <View
                  key={i}
                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i < found ? c.sage : 'transparent', borderWidth: 2, borderColor: c.sage }}
                />
              ))}
            </Row>
            <T variant="small" color={c.inkSoft} center>
              Name each one quietly or out loud, then tap.
            </T>
          </Animated.View>
        )}

        {done ? (
          <Button title="Done" onPress={() => router.back()} />
        ) : (
          <Tappable
            onPress={tapFound}
            accessibilityRole="button"
            accessibilityLabel={`Found one thing I can ${current.sense}`}
            style={{ backgroundColor: c.primary, borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center' }}
          >
            <T variant="bodyStrong" color={c.primaryInk}>
              I noticed one ({found}/{current.count})
            </T>
          </Tappable>
        )}
      </View>
    </View>
  );
}
