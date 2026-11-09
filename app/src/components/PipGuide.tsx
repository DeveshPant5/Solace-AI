import { Feather } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, useReducedMotion } from 'react-native-reanimated';

import { Pip, type PipMood } from '@/components/Pip';
import { Row, T, Tappable } from '@/components/ui';
import { usePipStage } from '@/lib/pipGrowth';
import { setVoiceEnabled, speak, stopSpeaking, useVoice } from '@/lib/voice';
import { radius, shadow, space, useTheme } from '@/theme';

/** Lines Pip has already said this session, so Pip never repeats a line when you go back. */
const spoken = new Set<string>();
/** Lines already typed out once; coming back to them shows the whole line straight away. */
const typed = new Set<string>();

/** Typing pace: unhurried, with a small breath after commas and full stops. */
const CHAR_MS = 34;
const pauseAfter = (ch: string) => (ch === '.' || ch === '?' || ch === '!' ? 260 : ch === ',' ? 140 : 0);

/**
 * The line appears letter by letter, like Pip is writing it. The untyped rest
 * is laid out invisibly, so the bubble is its final size from the start and
 * nothing shifts. Screen readers get the whole line at once.
 */
function TypedLine({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  const instant = reduceMotion || typed.has(text);
  const [count, setCount] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      i += 1;
      setCount(i);
      if (i >= text.length) {
        typed.add(text);
        return;
      }
      timer = setTimeout(step, CHAR_MS + pauseAfter(text[i - 1]!));
    };
    // Begin once the bubble has faded in.
    timer = setTimeout(step, 350);
    return () => clearTimeout(timer);
  }, [text, instant]);

  return (
    <T variant="body" style={{ fontSize: 16.5, lineHeight: 25 }} accessibilityLabel={text}>
      {text.slice(0, count)}
      <Text style={{ color: 'transparent' }}>{text.slice(count)}</Text>
    </T>
  );
}

const settle = FadeIn.duration(600).easing(Easing.out(Easing.sin));

/**
 * Pip with a speech bubble. Says `line` once (if voice is on) after a calm
 * pause, only on the screen in front, and stops when that screen goes away.
 * The speaker icon mutes or unmutes; tapping Pip hears the line again.
 */
export function PipGuide({
  line,
  mood = 'happy',
  size = 84,
  wave,
  stage,
  growFrom,
  layout = 'row',
  showPip = true,
  backdrop,
  backdropBehind = 'all',
  pipFrameStyle,
  children,
  style,
}: {
  line: string;
  mood?: PipMood;
  size?: number;
  wave?: boolean;
  /** Override the plant's growth; defaults to the person's tree for their garden level. */
  stage?: number;
  /** Grow from this stage into `stage` when Pip first appears. */
  growFrom?: number;
  /** "row": Pip beside the bubble. "stack": the bubble above Pip, centred. */
  layout?: 'row' | 'stack';
  /** Hide Pip, e.g. when Pip is already drawn nearby. */
  showPip?: boolean;
  /** Drawn behind the bubble and Pip in the stack layout, e.g. a window scene. */
  backdrop?: ReactNode;
  /** "all": the backdrop fills the whole guide. "pip": only a frame around Pip, with the bubble above it. */
  backdropBehind?: 'all' | 'pip';
  /** Size and padding of the frame around Pip when `backdropBehind` is "pip". */
  pipFrameStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { enabled, speaking, line: speakingLine } = useVoice();
  const growth = usePipStage();
  // Screens further down the stack stay mounted; only the one in front talks.
  const focused = useIsFocused();

  useEffect(() => {
    if (!enabled || !focused || spoken.has(line)) return;
    // Let the screen settle before speaking.
    const t = setTimeout(() => {
      spoken.add(line);
      void speak(line);
    }, 600);
    return () => clearTimeout(t);
  }, [line, enabled, focused]);

  useEffect(() => {
    if (!focused) stopSpeaking();
  }, [focused]);
  useEffect(() => () => stopSpeaking(), []);

  const replay = () => {
    if (enabled && focused) void speak(line);
  };

  const row = layout === 'row' && showPip;
  const bubble = (
    <Animated.View
      key={line}
      entering={settle}
      style={[
        {
          flex: row ? 1 : undefined,
          alignSelf: layout === 'stack' ? 'stretch' : undefined,
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderTopLeftRadius: row ? 8 : radius.lg,
          padding: space.lg,
          paddingRight: space.xxxl,
        },
        shadow(c, 1),
      ]}
    >
      <TypedLine text={line} />
      {children}
      {layout === 'stack' && (
        // A little tail pointing down at Pip.
        <View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: -7, left: '50%', marginLeft: -8, width: 16, height: 16, backgroundColor: c.surface, transform: [{ rotate: '45deg' }], borderRadius: 3 }}
        />
      )}
      {enabled !== null && (
        <Tappable
          onPress={() => void setVoiceEnabled(!enabled)}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!enabled }}
          accessibilityLabel={enabled ? "Mute Pip's voice" : "Turn on Pip's voice"}
          hitSlop={10}
          style={{ position: 'absolute', top: 10, right: 10, padding: 6 }}
        >
          <Feather name={enabled ? 'volume-2' : 'volume-x'} size={17} color={enabled ? c.primary : c.inkFaint} />
        </Tappable>
      )}
    </Animated.View>
  );

  const pip = (
    <Tappable onPress={replay} accessibilityLabel="Hear Pip again" haptics={false} scaleTo={0.97}>
      <Pip size={size} mood={mood} stage={stage ?? growth} growFrom={growFrom} speaking={speaking && speakingLine === line} wave={wave} />
    </Tappable>
  );

  if (!showPip) return <View style={style}>{bubble}</View>;
  if (layout === 'stack' && backdrop && backdropBehind === 'pip') {
    return (
      <Animated.View entering={settle} style={[{ alignItems: 'center', gap: space.lg }, style]}>
        {bubble}
        <View style={[{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-end' }, pipFrameStyle]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {backdrop}
          </View>
          {pip}
        </View>
      </Animated.View>
    );
  }
  if (layout === 'stack') {
    return (
      <Animated.View entering={settle} style={[{ alignItems: 'center', gap: space.lg }, style]}>
        {backdrop && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {backdrop}
          </View>
        )}
        {bubble}
        {pip}
      </Animated.View>
    );
  }
  return (
    <Row gap={space.sm} style={[{ alignItems: 'flex-start' }, style]}>
      <View style={{ marginTop: -space.md }}>{pip}</View>
      {bubble}
    </Row>
  );
}
