import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PipTip } from '@/components/PipTip';
import { Sol } from '@/components/Sol';
import { Button, Chip, Header, Pill, Row, T, Tappable } from '@/components/ui';
import { BREATH_PATTERNS, type BreathPattern } from '@/content/wellness';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { refreshTodaysTasks } from '@/lib/notifications';
import { fonts, radius, space, useTheme } from '@/theme';

export default function Breathe() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pattern: string }>();
  const [patternId, setPatternId] = useState(BREATH_PATTERNS[params.pattern ?? ''] ? params.pattern! : 'calm');
  const pattern = BREATH_PATTERNS[patternId]!;

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [left, setLeft] = useState(pattern.phases[0]!.seconds);
  const [finished, setFinished] = useState<{ xp: number } | null>(null);
  const elapsed = useRef(0);
  const scale = useSharedValue(0.55);

  const current = pattern.phases[phase]!;

  // Animate the circle and advance phases.
  useEffect(() => {
    if (!running) return;
    haptic.soft();
    setLeft(current.seconds);
    scale.value = withTiming(current.scale, { duration: current.seconds * 1000, easing: Easing.inOut(Easing.sin) });
    const tick = setInterval(() => {
      elapsed.current += 1;
      setLeft((s) => Math.max(1, s - 1));
    }, 1000);
    const next = setTimeout(() => {
      const lastPhase = phase === pattern.phases.length - 1;
      if (lastPhase && cycle + 1 >= pattern.cycles) {
        void complete();
        return;
      }
      if (lastPhase) setCycle((x) => x + 1);
      setPhase(lastPhase ? 0 : phase + 1);
    }, current.seconds * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, cycle, patternId]);

  const complete = async () => {
    setRunning(false);
    scale.value = withTiming(0.75, { duration: 800 });
    haptic.success();
    let xp = 0;
    try {
      const r = await api<{ xp: number }>('/activities', { body: { kind: 'breathing', meta: { pattern: pattern.id, seconds: elapsed.current } } });
      xp = r.xp;
      void refreshTodaysTasks();
    } catch {
      // Progress will simply not be recorded if offline.
    }
    setFinished({ xp });
  };

  const reset = (id = patternId) => {
    setRunning(false);
    setFinished(null);
    setPhase(0);
    setCycle(0);
    elapsed.current = 0;
    setLeft(BREATH_PATTERNS[id]!.phases[0]!.seconds);
    scale.value = withTiming(0.55, { duration: 600 });
  };

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: 0.25 + scale.value }], opacity: 0.2 + scale.value * 0.25 }));
  const totalSeconds = pattern.phases.reduce((s, p) => s + p.seconds, 0) * pattern.cycles;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={c.scheme === 'dark' ? ['#1E2A33', '#221F1D', c.bg] : ['#DDEBF4', '#EEF2EC', c.bg]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xl }}>
        <Header title={pattern.title} />
        {!running && !finished && <PipTip id="breathe" />}
        {!running && !finished && (
          <Row gap={space.sm} style={{ justifyContent: 'center' }}>
            {['calm', 'box', '478'].map((id) => BREATH_PATTERNS[id]!).map((p) => (
              <Chip
                key={p.id}
                label={p.title.replace(' breathing', '')}
                selected={p.id === patternId}
                onPress={() => {
                  setPatternId(p.id);
                  reset(p.id);
                }}
              />
            ))}
          </Row>
        )}

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[styles.halo, { backgroundColor: c.sky }, halo]} />
          <Animated.View style={[styles.circle, { backgroundColor: c.scheme === 'dark' ? '#3A5466' : '#BFDCEB' }, circle]} />
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <Sol size={110} mood={finished ? 'joyful' : 'calm'} animated={!running} tint={0} />
            {finished ? (
              <Animated.View entering={ZoomIn} style={{ alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
                <T variant="heading">Nicely done</T>
                {finished.xp > 0 && <Pill text={`+${finished.xp} XP`} icon="star" bg={c.butterSoft} fg={c.ink} />}
              </Animated.View>
            ) : running ? (
              <Animated.View key={`${cycle}-${phase}`} entering={FadeIn.duration(400)} style={{ alignItems: 'center', marginTop: space.sm }}>
                <T variant="title">{current.label}</T>
                <T variant="heading" color={c.inkSoft}>
                  {left}
                </T>
              </Animated.View>
            ) : null}
          </View>
        </View>

        {!finished && (
          <View style={{ alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
            <Rhythm phases={pattern.phases} active={running ? phase : -1} />
            {running ? (
              <T variant="small" color={c.inkFaint} center>
                Round {cycle + 1} of {pattern.cycles}
              </T>
            ) : (
              <T variant="quote" color={c.inkSoft} center style={styles.feel}>
                {pattern.feel}
              </T>
            )}
          </View>
        )}
        {finished ? (
          <View style={{ gap: space.sm }}>
            <Button title="Done" onPress={() => router.back()} />
            <Button title="Go again" kind="ghost" onPress={() => reset()} />
            <Tappable
              accessibilityRole="button"
              onPress={() => {
                const now = new Date();
                router.replace({
                  pathname: '/tasks/edit',
                  params: { activity: `breathe_${pattern.id}`, hour: String(now.getHours()), minute: String(Math.floor(now.getMinutes() / 5) * 5) },
                });
              }}
              style={{ alignSelf: 'center', paddingVertical: space.sm }}
            >
              <T variant="small" color={c.inkSoft} style={{ textDecorationLine: 'underline' }}>
                Make it a daily habit
              </T>
            </Tappable>
          </View>
        ) : running ? (
          <View style={{ gap: space.sm }}>
            <Button title="Pause" kind="secondary" icon="pause" onPress={() => setRunning(false)} />
            {elapsed.current >= 30 && <Button title="Finish now" kind="ghost" onPress={complete} />}
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <Button title={elapsed.current > 0 ? 'Resume' : 'Begin'} icon="play" onPress={() => setRunning(true)} />
            <T variant="small" color={c.inkFaint} center>
              About {Math.round(totalSeconds / 60)} minutes · find a comfortable position
            </T>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * The rhythm as counts: "5 in ~ 5 out", joined by little hand-drawn breath waves.
 * While a session runs, the step you're on stays clear and the rest soften.
 */
function Rhythm({ phases, active }: { phases: BreathPattern['phases']; active: number }) {
  const c = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={phases.map((p) => `${cue(p.label)} for ${p.seconds}`).join(', ')}
      style={[styles.rhythm, { backgroundColor: c.scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)' }]}
    >
      {phases.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <BreathWave color={c.inkFaint} />}
          <RhythmStep seconds={p.seconds} label={cue(p.label)} state={active < 0 ? 'idle' : active === i ? 'on' : 'off'} />
        </Fragment>
      ))}
    </View>
  );
}

function RhythmStep({ seconds, label, state }: { seconds: number; label: string; state: 'idle' | 'on' | 'off' }) {
  const c = useTheme();
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(state === 'off' ? 0.35 : 1, { duration: 700 }) }), [state]);
  return (
    <Animated.View style={[styles.step, fade]}>
      <Text style={[styles.count, { color: state === 'on' ? c.primary : c.ink }]}>{seconds}</Text>
      <Text style={[styles.cue, { color: state === 'on' ? c.primary : c.inkSoft }]}>{label}</Text>
    </Animated.View>
  );
}

/** A small, slightly uneven wave, like a pencil line drawn between counts. */
function BreathWave({ color }: { color: string }) {
  return (
    <Svg width={24} height={12} viewBox="0 0 20 10" style={{ marginBottom: 16 }}>
      <Path d="M1.5 5.4C3.6 1.6 6.4 1.4 8.6 4.8S14.2 8.9 18.6 4.3" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** "Breathe in" becomes "in", "Hold" becomes "hold". */
const cue = (label: string) => label.replace(/^breathe\s+/i, '').toLowerCase();

const styles = StyleSheet.create({
  circle: { position: 'absolute', width: 280, height: 280, borderRadius: 140 },
  halo: { position: 'absolute', width: 280, height: 280, borderRadius: 140 },
  rhythm: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.xl, borderRadius: radius.lg },
  step: { alignItems: 'center', minWidth: 36 },
  count: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums'] },
  cue: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16 },
  feel: { fontSize: 18, lineHeight: 24 },
});
