import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PipGuide } from '@/components/PipGuide';
import { WindowScene } from '@/components/WindowScene';
import { Button, Row, T, Tappable } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { setVoiceEnabled, useVoice } from '@/lib/voice';
import { fonts, space, useTheme } from '@/theme';

/** Pip's width here, and how far its feet sit above the bottom of the drawing, so it stands on the sill. */
const PIP = 206;
const SILL = 22;
const FEET = ((PIP * 290) / 240) * (22 / 290);

export default function Welcome() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { onboarding } = useAuth();
  const { enabled } = useVoice();

  const next = () => router.push(onboarding ? '/sign-up' : '/personalize');
  const start = async (voice: boolean) => {
    await setVoiceEnabled(voice);
    next();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* A warm wall, a little lighter towards the ceiling. */}
      <LinearGradient colors={[c.surfaceAlt, c.bg, c.sunken]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ paddingTop: insets.top + space.lg, alignItems: 'center', gap: 2 }}>
        <T style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 34 }} color={c.primary}>
          Solace
        </T>
        <T variant="small" color={c.inkSoft}>
          A softer place for your mind
        </T>
      </View>

      {/* The window fills the space between the wordmark and the buttons: Pip's line at the top, Pip on the sill. */}
      <View style={{ flex: 1, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.xxl }}>
        <PipGuide
          layout="stack"
          size={PIP}
          stage={0}
          wave
          backdrop={<WindowScene sill={SILL} />}
          style={{ flex: 1, justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: space.xxl, paddingBottom: SILL - FEET }}
          line="Hi, I'm Pip, a little sprout Sol planted just for you. I'll help you set up your cosy corner. It only takes a minute."
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
