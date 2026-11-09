import { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Sol } from '@/components/Sol';
import { T } from '@/components/ui';
import { fonts, radius, space, useTheme } from '@/theme';

export const DANCE_MS = 3000;
const BEAT = 250;
const BEATS = DANCE_MS / (BEAT * 2);

/**
 * The wardrobe's reward: Luma hops and sways for three seconds and asks to be
 * dressed up, then `onDone` runs (which opens the wardrobe). A tap skips ahead.
 * With reduced motion on, Luma only sways.
 */
export function LumaDance({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const c = useTheme();
  const reduceMotion = useReducedMotion();
  const sway = useSharedValue(0);
  const hop = useSharedValue(0);
  const squash = useSharedValue(1);
  const noteA = useSharedValue(0);
  const noteB = useSharedValue(0);
  const finish = useRef(onDone);
  finish.current = onDone;

  useEffect(() => {
    if (!visible) return;
    const sine = Easing.inOut(Easing.sin);
    sway.value = withRepeat(withSequence(withTiming(-14, { duration: BEAT, easing: sine }), withTiming(14, { duration: BEAT, easing: sine })), BEATS);
    if (!reduceMotion) {
      hop.value = withRepeat(
        withSequence(withTiming(-28, { duration: BEAT, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: BEAT, easing: Easing.in(Easing.quad) })),
        BEATS,
      );
      squash.value = withRepeat(
        withSequence(withTiming(1.05, { duration: BEAT }), withTiming(0.92, { duration: BEAT * 0.6 }), withTiming(1, { duration: BEAT * 0.4 })),
        BEATS,
      );
      noteA.value = withRepeat(withTiming(1, { duration: 1000 }), 3);
      noteB.value = withDelay(500, withRepeat(withTiming(1, { duration: 1000 }), 3));
    }
    const timer = setTimeout(() => finish.current(), DANCE_MS);
    return () => {
      clearTimeout(timer);
      [sway, hop, squash, noteA, noteB].forEach((v) => cancelAnimation(v));
      sway.value = 0;
      hop.value = 0;
      squash.value = 1;
      noteA.value = 0;
      noteB.value = 0;
    };
  }, [visible, reduceMotion, sway, hop, squash, noteA, noteB]);

  const dancer = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { rotate: `${sway.value}deg` }, { scaleY: squash.value }, { scaleX: 2 - squash.value }],
  }));
  const shadow = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + hop.value / 70 }], opacity: 0.18 + hop.value / 300 }));
  const floatA = useAnimatedStyle(() => ({
    opacity: noteA.value === 0 ? 0 : 1 - noteA.value,
    transform: [{ translateY: -70 * noteA.value }, { translateX: -14 * noteA.value }],
  }));
  const floatB = useAnimatedStyle(() => ({
    opacity: noteB.value === 0 ? 0 : 1 - noteB.value,
    transform: [{ translateY: -70 * noteB.value }, { translateX: 14 * noteB.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => finish.current()} statusBarTranslucent>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.scheme === 'dark' ? 'rgba(16,14,20,0.72)' : 'rgba(251,246,238,0.92)' }]}
        onPress={() => finish.current()}
        accessibilityRole="button"
        accessibilityLabel="Luma is dancing. Tap to open the wardrobe."
      >
        <Animated.View entering={ZoomIn.delay(250).springify().damping(14)} style={[styles.bubble, { backgroundColor: c.surface }]}>
          <T variant="heading" center>
            Please customize me, I have danced for you.
          </T>
          <View style={[styles.tail, { backgroundColor: c.surface }]} />
        </Animated.View>

        <View style={styles.stage}>
          <Animated.Text style={[styles.note, { color: c.primary, left: 34 }, floatA]}>♪</Animated.Text>
          <Animated.Text style={[styles.note, { color: c.peach, right: 34 }, floatB]}>♫</Animated.Text>
          <Animated.View style={dancer}>
            <Sol size={210} mood="joyful" animated={false} />
          </Animated.View>
          <Animated.View style={[styles.shadow, { backgroundColor: c.ink }, shadow]} />
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.inkFaint, marginTop: space.lg }}>Opening the wardrobe…</Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  bubble: {
    maxWidth: 300,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.xl,
    marginBottom: space.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  tail: { position: 'absolute', bottom: -8, alignSelf: 'center', width: 18, height: 18, transform: [{ rotate: '45deg' }], borderRadius: 3 },
  stage: { width: 280, height: 260, alignItems: 'center', justifyContent: 'flex-end' },
  note: { position: 'absolute', top: 40, fontSize: 30 },
  shadow: { width: 110, height: 14, borderRadius: 7, marginTop: -6 },
});
