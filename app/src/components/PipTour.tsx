import { Feather } from '@expo/vector-icons';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ONBOARDING_LAST_STAGE, Pip, type PipMood } from '@/components/Pip';
import { PipGuide } from '@/components/PipGuide';
import { markTipsSeen, resetTips } from '@/components/PipTip';
import { Sol } from '@/components/Sol';
import { Button, Row, T, Tappable } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { usePipStage } from '@/lib/pipGrowth';
import { storage } from '@/lib/storage';
import { stopSpeaking } from '@/lib/voice';
import { space, useTheme } from '@/theme';

/**
 * A short, unhurried first-run tour of Home with Pip: Pip introduces Luma,
 * points out the three things worth knowing, and says goodbye. Shown once
 * per account on this device; You → "Take the tour with Pip" replays it.
 */

type Stop = { line: string; mood: PipMood; arrow?: 'up' | 'down'; arrowLeft?: boolean; meetSol?: boolean; grown?: boolean; wave?: boolean };

const STOPS: Stop[] = [
  { line: "Look, I've grown into a little tree. Thank you for taking this moment for yourself.", mood: 'happy', grown: true },
  { line: 'This is Luma, who planted me just for you. Luma is here whenever you want to talk, day or night.', mood: 'happy', meetSol: true, wave: true },
  { line: 'Start here each day. Tap how you feel up top. It only takes a moment.', mood: 'curious', arrow: 'up' },
  { line: 'Luma lives in the glowing button down here. Tap it any time you want to talk things through.', mood: 'happy', arrow: 'down' },
  { line: 'Practices has calm tools for hard moments. Journey is where you can watch me grow.', mood: 'thinking', arrow: 'down', arrowLeft: true },
  { line: "That's everything for now. I'll share a little tip when you visit somewhere new.", mood: 'calm', wave: true },
];

const key = (userId: string) => `solace.tour.${userId}`;

let replayRequested = false;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The tour is for new accounts: one created within this long. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

/**
 * Signing in to an existing account (a new phone, or after reinstalling): skip
 * the tour and the first-visit tips. "Take the tour with Pip" still replays them.
 */
export async function markTourSeen(userId: string) {
  await Promise.all([storage.set(key(userId), 'done'), markTipsSeen(userId)]);
}

/** Show the tour (and the screen tips) again, next time Home is open. */
export async function replayTour(userId: string) {
  await resetTips(userId);
  replayRequested = true;
  listeners.forEach((l) => l());
}

function Arrow({ direction }: { direction: 'up' | 'down' }) {
  const c = useTheme();
  const reduce = useReducedMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    drift.value = withRepeat(withTiming(direction === 'up' ? -6 : 6, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift, direction, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drift.value }] }));
  return (
    <Animated.View style={[{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Feather name={direction === 'up' ? 'arrow-up' : 'arrow-down'} size={20} color={c.primary} />
    </Animated.View>
  );
}

export function PipTour() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const stage = usePipStage();
  const replay = useSyncExternalStore(subscribe, () => replayRequested, () => replayRequested);
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Give Home a moment to settle before Pip appears.
    const t = setTimeout(() => {
      void storage.get(key(user.id)).then((v) => {
        if (cancelled) return;
        const isNewAccount = Date.now() - Date.parse(user.createdAt) < NEW_ACCOUNT_MS;
        if ((v !== 'done' && isNewAccount) || replayRequested) {
          replayRequested = false;
          setI(0);
          setVisible(true);
        }
      });
    }, 1400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [user, replay]);

  if (!visible || !user) return null;

  const stop = STOPS[i]!;
  const last = i === STOPS.length - 1;
  const finish = () => {
    stopSpeaking();
    setVisible(false);
    void storage.set(key(user.id), 'done');
  };

  return (
    <Animated.View
      entering={FadeIn.duration(700).easing(Easing.out(Easing.sin))}
      exiting={FadeOut.duration(500).easing(Easing.in(Easing.sin))}
      style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: 0.8 }]} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingBottom: insets.bottom + 92 }}>
        {stop.arrow === 'up' && (
          <View style={{ alignItems: 'center', marginBottom: space.md }}>
            <Arrow direction="up" />
          </View>
        )}

        {stop.grown && (
          // Entering the app: the young tree from sign-up grows into Pip's tree.
          <Animated.View entering={FadeIn.duration(800)} style={{ alignItems: 'center', marginBottom: space.md }}>
            <Pip size={150} mood="happy" stage={stage} growFrom={ONBOARDING_LAST_STAGE} />
          </Animated.View>
        )}

        {stop.meetSol && (
          <Animated.View entering={FadeIn.duration(800)} style={{ alignItems: 'center', marginBottom: space.md }}>
            <Row gap={0} style={{ alignItems: 'flex-end' }}>
              <Sol size={140} mood="happy" />
              <Pip size={84} mood="happy" stage={stage} wave style={{ marginLeft: -18 }} />
            </Row>
          </Animated.View>
        )}

        <PipGuide line={stop.line} mood={stop.mood} wave={stop.wave} size={72} showPip={!stop.meetSol && !stop.grown}>
          <Row gap={space.sm} style={{ marginTop: space.lg, justifyContent: 'space-between' }}>
            <T variant="small" color={c.inkFaint}>
              {i + 1} of {STOPS.length}
            </T>
            <Row gap={space.sm}>
              {!last && (
                <Tappable onPress={finish} hitSlop={8} style={{ paddingHorizontal: space.sm }}>
                  <T variant="small" color={c.inkSoft}>
                    Skip
                  </T>
                </Tappable>
              )}
              <Button title={last ? 'Done' : i === 0 ? 'Show me around' : 'Next'} small onPress={() => (last ? finish() : setI(i + 1))} />
            </Row>
          </Row>
        </PipGuide>

        {stop.arrow === 'down' && (
          <View style={{ alignItems: stop.arrowLeft ? 'flex-start' : 'center', marginTop: space.md, paddingLeft: stop.arrowLeft ? '18%' : 0 }}>
            <Arrow direction="down" />
          </View>
        )}
      </View>
    </Animated.View>
  );
}
