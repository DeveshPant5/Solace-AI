import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PipGuide } from '@/components/PipGuide';
import { WindowScene } from '@/components/WindowScene';
import { Button, Row, T, Tappable } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { setVoiceEnabled, useVoice } from '@/lib/voice';
import { fonts, space, useTheme } from '@/theme';

const SILL = 20;

/**
 * Sizes for this screen by phone height, so everything fits without scrolling:
 * Pip's width, the sky above its head (for the sun or moon) and the wordmark.
 */
function sizesFor(height: number) {
  const tier = height >= 860 ? { pip: 150, sky: 74, mark: 52 } : height >= 800 ? { pip: 128, sky: 58, mark: 48 } : { pip: 106, sky: 44, mark: 42 };
  const pipH = (tier.pip * 290) / 240;
  // How far Pip's feet sit above the bottom of its drawing, so it stands on the sill.
  const feet = pipH * (22 / 290);
  return { ...tier, pipH, feet, windowH: Math.round(pipH + tier.sky), compact: height < 800 };
}

export default function Welcome() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { onboarding } = useAuth();
  const { enabled } = useVoice();
  const size = sizesFor(useWindowDimensions().height);

  const next = () => router.push(onboarding ? '/sign-up' : '/personalize');
  const start = async (voice: boolean) => {
    await setVoiceEnabled(voice);
    next();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* A warm wall, a little lighter towards the ceiling. */}
      <LinearGradient colors={[c.surfaceAlt, c.bg, c.sunken]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ paddingTop: insets.top + (size.compact ? space.lg : space.xxl), alignItems: 'center', gap: space.xs }}>
        <T style={{ fontFamily: fonts.display, fontSize: size.mark, lineHeight: Math.round(size.mark * 1.15), letterSpacing: -0.8 }} color={c.primary}>
          Solace
        </T>
        <T variant="quote" color={c.inkSoft} style={{ fontSize: size.compact ? 17 : 19, lineHeight: size.compact ? 23 : 26 }}>
          A softer place for your mind
        </T>
      </View>

      {/* Pip's line, then a small window with Pip waving on the sill, centred between the wordmark and the buttons. */}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xl, paddingVertical: size.compact ? space.sm : space.lg }}>
        <PipGuide
          layout="stack"
          size={size.pip}
          stage={0}
          wave
          backdrop={<WindowScene sill={SILL} bandTop={22} bandBottomFromSill={size.pipH} />}
          backdropBehind="pip"
          pipFrameStyle={{ height: size.windowH + SILL, marginHorizontal: space.xl, paddingBottom: SILL - size.feet }}
          line="Hi, I'm Pip, a little sprout Luma planted just for you. I'll help you set up your cosy corner. It only takes a minute."
        />
      </View>

      <View style={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xl, gap: space.md }}>
        {enabled === null ? (
          <>
            <Button title="Yes, talk me through it" icon="volume-2" onPress={() => void start(true)} />
            <Button title="I'll just read" kind="secondary" onPress={() => void start(false)} />
          </>
        ) : (
          <Button title="Let's begin" icon="arrow-right" onPress={next} />
        )}
        <Row style={{ justifyContent: 'center', marginTop: space.xs }} gap={6}>
          <T variant="small" color={c.inkSoft}>
            Already have an account?
          </T>
          <Tappable onPress={() => router.push('/sign-in')} hitSlop={10} accessibilityRole="link">
            <T variant="small" color={c.primary} style={{ fontFamily: fonts.bold }}>
              Sign in
            </T>
          </Tappable>
        </Row>
        <Row style={{ justifyContent: 'center' }} gap={6}>
          <Feather name="lock" size={13} color={c.inkFaint} />
          <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
            Private by design. Delete your data any time.
          </T>
        </Row>
      </View>
    </View>
  );
}
