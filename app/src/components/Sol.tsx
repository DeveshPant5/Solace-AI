import { useEffect, useId, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

export type SolMood = 'happy' | 'calm' | 'listening' | 'concerned' | 'joyful' | 'sleepy' | 'thinking';

/** Sol's colours shift gently with the person's mood (1 = very low … 5 = great). */
const TINTS: Record<number, [string, string, string]> = {
  0: ['#FFC2A8', '#C9B8FF', '#9CCBF5'],
  1: ['#B9C9F2', '#A9B6EC', '#8FB2E8'],
  2: ['#D4C4FF', '#B7A6F7', '#A3B9F2'],
  3: ['#FFE2A0', '#F9C9A0', '#D8C2F5'],
  4: ['#BFE8C9', '#9DD6C0', '#A8CFF0'],
  5: ['#FFD08F', '#FFAE95', '#F6A2C4'],
};

export function moodToExpression(mood: number | null | undefined): SolMood {
  switch (mood) {
    case 1:
      return 'concerned';
    case 2:
      return 'listening';
    case 3:
      return 'calm';
    case 4:
      return 'happy';
    case 5:
      return 'joyful';
    default:
      return 'happy';
  }
}

const INK = '#2A2340';

function Eyes({ mood, blink }: { mood: SolMood; blink: boolean }) {
  const stroke = { stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' as const, fill: 'none' };
  if (mood === 'calm' || mood === 'joyful') {
    // Closed, smiling eyes.
    return (
      <G>
        <Path d="M69 108 Q78 99 87 108" {...stroke} />
        <Path d="M113 108 Q122 99 131 108" {...stroke} />
      </G>
    );
  }
  if (mood === 'sleepy') {
    return (
      <G>
        <Path d="M69 106 Q78 113 87 106" {...stroke} />
        <Path d="M113 106 Q122 113 131 106" {...stroke} />
      </G>
    );
  }
  const ry = blink ? 1.2 : 8;
  return (
    <G>
      <Ellipse cx={78} cy={107} rx={6.5} ry={ry} fill={INK} />
      <Ellipse cx={122} cy={107} rx={6.5} ry={ry} fill={INK} />
      {!blink && (
        <G>
          <Circle cx={80.5} cy={103.5} r={2.2} fill="#FFFFFF" />
          <Circle cx={124.5} cy={103.5} r={2.2} fill="#FFFFFF" />
        </G>
      )}
      {mood === 'concerned' && (
        <G>
          <Path d="M68 92 Q76 88 85 92" {...stroke} strokeWidth={3.5} />
          <Path d="M115 92 Q124 88 132 92" {...stroke} strokeWidth={3.5} />
        </G>
      )}
      {mood === 'thinking' && <Path d="M114 90 Q123 85 132 89" {...stroke} strokeWidth={3.5} />}
    </G>
  );
}

function Mouth({ mood }: { mood: SolMood }) {
  const stroke = { stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' as const, fill: 'none' };
  switch (mood) {
    case 'joyful':
      return <Path d="M85 125 Q100 147 115 125 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
    case 'happy':
      return <Path d="M87 127 Q100 140 113 127" {...stroke} />;
    case 'calm':
      return <Path d="M91 129 Q100 136 109 129" {...stroke} />;
    case 'listening':
      return <Ellipse cx={100} cy={131} rx={5} ry={4.5} fill={INK} />;
    case 'concerned':
      return <Path d="M91 134 Q100 128 109 134" {...stroke} />;
    case 'sleepy':
      return <Ellipse cx={100} cy={131} rx={4} ry={3} fill={INK} />;
    case 'thinking':
      return <Path d="M93 132 Q102 131 110 127" {...stroke} />;
  }
}

/**
 * Sol's little arms and feet, in the same soft colours as its body. Drawn before
 * the body, so the body covers where they join. When Sol is joyful, one hand waves.
 */
function Limbs({ mood, arm, foot }: { mood: SolMood; arm: string; foot: string }) {
  const limb = { stroke: arm, strokeWidth: 10, strokeLinecap: 'round' as const, fill: 'none' };
  const waving = mood === 'joyful';
  return (
    <G>
      {/* Legs and feet */}
      <Path d="M86 146 Q84 160 83 171" stroke={foot} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Path d="M114 146 Q116 160 117 171" stroke={foot} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Ellipse cx={78} cy={177} rx={13} ry={7.5} fill={foot} transform="rotate(-8 78 177)" />
      <Ellipse cx={122} cy={177} rx={13} ry={7.5} fill={foot} transform="rotate(8 122 177)" />
      <Ellipse cx={79} cy={181} rx={9} ry={2.6} fill={INK} opacity={0.1} />
      <Ellipse cx={121} cy={181} rx={9} ry={2.6} fill={INK} opacity={0.1} />
      {/* Arms with mitten hands */}
      <Path d="M50 100 Q32 106 27 121" {...limb} />
      <Ellipse cx={25} cy={125} rx={9} ry={9.5} fill={arm} />
      <Ellipse cx={22} cy={121} rx={3} ry={2} fill="#FFFFFF" opacity={0.35} />
      {waving ? (
        <G>
          <Path d="M150 98 Q170 90 176 74" {...limb} />
          <Ellipse cx={177} cy={70} rx={9} ry={9.5} fill={arm} />
          <Ellipse cx={174} cy={66} rx={3} ry={2} fill="#FFFFFF" opacity={0.35} />
        </G>
      ) : (
        <G>
          <Path d="M150 100 Q168 106 173 121" {...limb} />
          <Ellipse cx={175} cy={125} rx={9} ry={9.5} fill={arm} />
          <Ellipse cx={172} cy={121} rx={3} ry={2} fill="#FFFFFF" opacity={0.35} />
        </G>
      )}
    </G>
  );
}

export function Sol({
  size = 120,
  mood = 'happy',
  tint = 0,
  animated = true,
  limbs,
  style,
}: {
  size?: number;
  mood?: SolMood;
  /** Mood value 1-5 to tint Sol, or 0 for the default glow. */
  tint?: number;
  animated?: boolean;
  /** Arms and feet. On by default for larger Sols; small ones (avatars, the tab button) stay a simple face. */
  limbs?: boolean;
  style?: ViewStyle;
}) {
  const withLimbs = limbs ?? size >= 80;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [c1, c2, c3] = TINTS[tint] ?? TINTS[0]!;
  const [blink, setBlink] = useState(false);

  const float = useSharedValue(0);
  const breathe = useSharedValue(1);
  useEffect(() => {
    if (!animated) return;
    float.value = withRepeat(
      withSequence(
        withTiming(-size * 0.04, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [animated, size, float, breathe]);

  useEffect(() => {
    if (!animated) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        timer = setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 2600 + Math.random() * 2800);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [animated]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: breathe.value }],
  }));

  return (
    <View style={[{ width: size, height: size }, style]} accessibilityRole="image" accessibilityLabel="Sol, your companion">
      <Animated.View style={[{ width: size, height: size }, motion]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id={`glow${id}`} cx="50%" cy="56%" r="50%">
              <Stop offset="0%" stopColor={c2} stopOpacity={0.55} />
              <Stop offset="100%" stopColor={c2} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`body${id}`} x1="0.15" y1="0.05" x2="0.85" y2="1">
              <Stop offset="0%" stopColor={c1} />
              <Stop offset="55%" stopColor={c2} />
              <Stop offset="100%" stopColor={c3} />
            </LinearGradient>
            <LinearGradient id={`leaf${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#A9E3B8" />
              <Stop offset="100%" stopColor="#6FBF8C" />
            </LinearGradient>
          </Defs>
          <Circle cx={100} cy={112} r={98} fill={`url(#glow${id})`} />
          {withLimbs && <Limbs mood={mood} arm={c2} foot={c3} />}
          {/* With limbs, the body is drawn a little smaller and higher to leave room for the feet. */}
          <G transform={withLimbs ? 'translate(14 2) scale(0.86)' : undefined}>
          {/* Sprout */}
          <Path d="M100 48 Q99 36 101 26" stroke="#6FBF8C" strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M100 33 C90 20 75 20 69 28 C78 38 92 39 100 33 Z" fill={`url(#leaf${id})`} />
          <Path d="M101 28 C110 13 127 12 134 20 C125 31 110 34 101 28 Z" fill={`url(#leaf${id})`} />
          {/* Body */}
          <Path
            d="M100 44 C141 44 172 73 172 113 C172 153 141 180 100 180 C59 180 28 153 28 113 C28 73 59 44 100 44 Z"
            fill={`url(#body${id})`}
          />
          <Ellipse cx={72} cy={74} rx={20} ry={10} fill="#FFFFFF" opacity={0.42} transform="rotate(-28 72 74)" />
          <Ellipse cx={140} cy={150} rx={14} ry={7} fill="#FFFFFF" opacity={0.18} transform="rotate(-30 140 150)" />
          {/* Cheeks */}
          <Ellipse cx={64} cy={124} rx={10} ry={6.5} fill="#FF8FAB" opacity={0.45} />
          <Ellipse cx={136} cy={124} rx={10} ry={6.5} fill="#FF8FAB" opacity={0.45} />
          <Eyes mood={mood} blink={blink} />
          <Mouth mood={mood} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
