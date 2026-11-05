import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Sol } from '@/components/Sol';
import { T } from '@/components/ui';
import { fonts, useTheme } from '@/theme';

/**
 * Opening moment shown over the app on launch: Sol rises like the morning sun
 * through a warm sky, the wordmark settles in, then everything fades away.
 */
const SKY = {
  light: { colors: ['#FDF7EE', '#FBE9D6', '#F7D2B2', '#F1B88F'] as const, ink: '#3B322C', soft: 'rgba(59, 50, 44, 0.7)' },
  dark: { colors: ['#1A1613', '#2E221B', '#6B4231', '#B9775A'] as const, ink: '#FFF6EC', soft: 'rgba(255, 246, 236, 0.8)' },
};

export function SplashIntro() {
  const c = useTheme();
  const sky = SKY[c.scheme];
  const [visible, setVisible] = useState(true);
  const rise = useSharedValue(80);
  const sun = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    rise.value = withTiming(0, { duration: 1100, easing: Easing.out(Easing.cubic) });
    sun.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) });
    fade.value = withDelay(
      2100,
      withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(setVisible, false);
      }),
    );
  }, [rise, sun, fade]);

  const container = useAnimatedStyle(() => ({ opacity: fade.value }));
  const solStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }], opacity: Math.min(1, sun.value * 1.5) }));
  const glow = useAnimatedStyle(() => ({ opacity: sun.value * 0.8, transform: [{ scale: 0.6 + sun.value * 0.6 }] }));

  if (!visible) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100 }, container]} pointerEvents="none">
      <LinearGradient colors={sky.colors} locations={[0, 0.4, 0.78, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Animated.View style={[styles.glow, glow]}>
          <Svg width={360} height={360}>
            <Defs>
              <RadialGradient id="sunrise" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFF1D6" stopOpacity={0.95} />
                <Stop offset="45%" stopColor="#FFDDB8" stopOpacity={0.5} />
                <Stop offset="100%" stopColor="#FFC6A8" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={180} cy={180} r={180} fill="url(#sunrise)" />
          </Svg>
        </Animated.View>
        <Animated.View style={solStyle}>
          <Sol size={150} mood="calm" />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(700).duration(700)} style={{ alignItems: 'center', marginTop: 24 }}>
          <T style={{ fontFamily: fonts.display, fontSize: 46, lineHeight: 54, color: sky.ink }}>Solace</T>
          <T variant="body" color={sky.soft} style={{ marginTop: 6 }}>
            A softer place for your mind
          </T>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 360,
    height: 360,
    top: '50%',
    marginTop: -250,
  },
});
