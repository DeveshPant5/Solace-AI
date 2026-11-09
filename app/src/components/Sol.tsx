import { useEffect, useId, useState, type ReactNode } from 'react';
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

import { useSolLook, type CheekChoice, type FruitId, type GlassesChoice, type SolLook } from '@/lib/solLook';

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
const stroke = { stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

type EyeStyle = 'round' | 'big' | 'happy' | 'sleepy' | 'angry' | 'worried' | 'wink' | 'hearts' | 'stars' | 'thinking';
type MouthStyle = 'smile' | 'grin' | 'soft' | 'listen' | 'frown' | 'small' | 'smirk' | 'tongue' | 'cat' | 'open' | 'flat' | 'grumpy';

/** Sol's own eyes for each mood (what "As Sol feels" means). */
function moodEyes(mood: SolMood): EyeStyle {
  if (mood === 'calm' || mood === 'joyful') return 'happy';
  if (mood === 'sleepy') return 'sleepy';
  if (mood === 'concerned') return 'worried';
  if (mood === 'thinking') return 'thinking';
  return 'round';
}

const MOOD_MOUTH: Record<SolMood, MouthStyle> = {
  joyful: 'grin',
  happy: 'smile',
  calm: 'soft',
  listening: 'listen',
  concerned: 'frown',
  sleepy: 'small',
  thinking: 'smirk',
};

const heart = (x: number, y: number) =>
  `M${x} ${y + 7}C${x - 2} ${y + 5} ${x - 9} ${y} ${x - 9} ${y - 4}C${x - 9} ${y - 8} ${x - 5} ${y - 10} ${x - 2.5} ${y - 10}C${x - 1} ${y - 10} ${x} ${y - 9} ${x} ${y - 7}C${x} ${y - 9} ${x + 1} ${y - 10} ${x + 2.5} ${y - 10}C${x + 5} ${y - 10} ${x + 9} ${y - 8} ${x + 9} ${y - 4}C${x + 9} ${y} ${x + 2} ${y + 5} ${x} ${y + 7}Z`;
const sparkle = (x: number, y: number) =>
  `M${x} ${y - 10}Q${x + 1.8} ${y - 1.8} ${x + 10} ${y}Q${x + 1.8} ${y + 1.8} ${x} ${y + 10}Q${x - 1.8} ${y + 1.8} ${x - 10} ${y}Q${x - 1.8} ${y - 1.8} ${x} ${y - 10}Z`;

function Dots({ ry, rx = 6.5, cy = 107, shine = true }: { ry: number; rx?: number; cy?: number; shine?: boolean }) {
  return (
    <G>
      <Ellipse cx={78} cy={cy} rx={rx} ry={ry} fill={INK} />
      <Ellipse cx={122} cy={cy} rx={rx} ry={ry} fill={INK} />
      {shine && ry > 2 && (
        <G>
          <Circle cx={80.5} cy={cy - 3.5} r={2.2} fill="#FFFFFF" />
          <Circle cx={124.5} cy={cy - 3.5} r={2.2} fill="#FFFFFF" />
        </G>
      )}
    </G>
  );
}

function Eyes({ style, blink }: { style: EyeStyle; blink: boolean }) {
  const open = blink ? 1.2 : 8;
  switch (style) {
    case 'happy':
      return (
        <G>
          <Path d="M69 108 Q78 99 87 108" {...stroke} />
          <Path d="M113 108 Q122 99 131 108" {...stroke} />
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Path d="M69 106 Q78 113 87 106" {...stroke} />
          <Path d="M113 106 Q122 113 131 106" {...stroke} />
        </G>
      );
    case 'worried':
      return (
        <G>
          <Dots ry={open} />
          <Path d="M68 92 Q76 88 85 92" {...stroke} strokeWidth={3.5} />
          <Path d="M115 92 Q124 88 132 92" {...stroke} strokeWidth={3.5} />
        </G>
      );
    case 'thinking':
      return (
        <G>
          <Dots ry={open} />
          <Path d="M114 90 Q123 85 132 89" {...stroke} strokeWidth={3.5} />
        </G>
      );
    case 'angry':
      return (
        <G>
          <Dots ry={blink ? 1.2 : 6.5} cy={108} />
          <Path d="M66 91 L87 99" {...stroke} />
          <Path d="M134 91 L113 99" {...stroke} />
        </G>
      );
    case 'big':
      return (
        <G>
          <Ellipse cx={78} cy={106} rx={9} ry={blink ? 1.2 : 11} fill={INK} />
          <Ellipse cx={122} cy={106} rx={9} ry={blink ? 1.2 : 11} fill={INK} />
          {!blink && (
            <G>
              <Circle cx={81.5} cy={101} r={3.4} fill="#FFFFFF" />
              <Circle cx={125.5} cy={101} r={3.4} fill="#FFFFFF" />
              <Circle cx={75} cy={111} r={1.6} fill="#FFFFFF" />
              <Circle cx={119} cy={111} r={1.6} fill="#FFFFFF" />
            </G>
          )}
        </G>
      );
    case 'wink':
      return (
        <G>
          <Path d="M69 108 Q78 99 87 108" {...stroke} />
          <Ellipse cx={122} cy={107} rx={6.5} ry={8} fill={INK} />
          <Circle cx={124.5} cy={103.5} r={2.2} fill="#FFFFFF" />
        </G>
      );
    case 'hearts':
      return (
        <G>
          <Path d={heart(78, 108)} fill="#EF4B6E" />
          <Path d={heart(122, 108)} fill="#EF4B6E" />
          <Circle cx={73.5} cy={102} r={1.8} fill="#FFFFFF" opacity={0.8} />
          <Circle cx={117.5} cy={102} r={1.8} fill="#FFFFFF" opacity={0.8} />
        </G>
      );
    case 'stars':
      return (
        <G>
          <Path d={sparkle(78, 107)} fill={INK} />
          <Path d={sparkle(122, 107)} fill={INK} />
        </G>
      );
    default:
      return <Dots ry={open} />;
  }
}

function Mouth({ style }: { style: MouthStyle }) {
  switch (style) {
    case 'grin':
      return <Path d="M85 125 Q100 147 115 125 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
    case 'smile':
      return <Path d="M87 127 Q100 140 113 127" {...stroke} />;
    case 'soft':
      return <Path d="M91 129 Q100 136 109 129" {...stroke} />;
    case 'listen':
      return <Ellipse cx={100} cy={131} rx={5} ry={4.5} fill={INK} />;
    case 'frown':
      return <Path d="M91 134 Q100 128 109 134" {...stroke} />;
    case 'small':
      return <Ellipse cx={100} cy={131} rx={4} ry={3} fill={INK} />;
    case 'smirk':
      return <Path d="M93 132 Q102 131 110 127" {...stroke} />;
    case 'tongue':
      return (
        <G>
          <Path d="M85 125 Q100 147 115 125 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Ellipse cx={101} cy={138} rx={7} ry={5} fill="#FF8FA3" />
        </G>
      );
    case 'cat':
      return <Path d="M87 128 Q93.5 136 100 129 Q106.5 136 113 128" {...stroke} />;
    case 'open':
      return <Ellipse cx={100} cy={132} rx={6.5} ry={8} fill={INK} />;
    case 'flat':
      return <Path d="M90 131 L110 131" {...stroke} />;
    case 'grumpy':
      return <Path d="M87 134 L93.5 129 L100 134 L106.5 129 L113 134" {...stroke} />;
  }
}

function Cheeks({ style }: { style: CheekChoice }) {
  if (style === 'none') return null;
  return (
    <G>
      <Ellipse cx={64} cy={124} rx={10} ry={6.5} fill="#FF8FAB" opacity={style === 'freckles' ? 0.28 : 0.45} />
      <Ellipse cx={136} cy={124} rx={10} ry={6.5} fill="#FF8FAB" opacity={style === 'freckles' ? 0.28 : 0.45} />
      {style === 'freckles' &&
        [
          [59, 120],
          [66, 124],
          [58, 127],
          [141, 120],
          [134, 124],
          [142, 127],
        ].map(([x, y]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="#A8684C" opacity={0.6} />)}
    </G>
  );
}

function Glasses({ style }: { style: GlassesChoice }) {
  if (style === 'none') return null;
  const frame = { stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round' as const, fill: 'none' };
  if (style === 'round') {
    return (
      <G>
        <Circle cx={78} cy={107} r={15} fill="#FFFFFF" opacity={0.18} />
        <Circle cx={122} cy={107} r={15} fill="#FFFFFF" opacity={0.18} />
        <Circle cx={78} cy={107} r={15} {...frame} />
        <Circle cx={122} cy={107} r={15} {...frame} />
        <Path d="M93 104 Q100 99 107 104" {...frame} />
        <Path d="M63 103 L52 99" {...frame} />
        <Path d="M137 103 L148 99" {...frame} />
      </G>
    );
  }
  const lens = (x: number, y: number) =>
    `M${x - 16} ${y - 7}Q${x - 16} ${y - 10} ${x - 13} ${y - 10}L${x + 13} ${y - 10}Q${x + 16} ${y - 10} ${x + 16} ${y - 7}Q${x + 15} ${y + 11} ${x} ${y + 11}Q${x - 15} ${y + 11} ${x - 16} ${y - 7}Z`;
  return (
    <G>
      <Path d={lens(78, 106)} fill={INK} />
      <Path d={lens(122, 106)} fill={INK} />
      <Path d="M70 100 L76 100" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
      <Path d="M114 100 L120 100" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
      <Path d="M94 98 Q100 95 106 98" {...frame} />
      <Path d="M62 99 L52 96" {...frame} />
      <Path d="M138 99 L148 96" {...frame} />
    </G>
  );
}

/** The fruits Sol can be: colours (light to deep), the body's outline, and what grows on top. */
const FRUIT: Record<Exclude<FruitId, 'classic'>, { colors: [string, string, string]; body: string; top: (leaf: string) => ReactNode; marks?: ReactNode }> = {
  apple: {
    colors: ['#FF9A8B', '#F2615F', '#D9474F'],
    body: 'M100 60 C110 48 132 42 152 54 C174 68 178 102 170 130 C162 160 140 180 116 178 C109 177 105 174 100 174 C95 174 91 177 84 178 C60 180 38 160 30 130 C22 102 26 68 48 54 C68 42 90 48 100 60 Z',
    top: (leaf) => (
      <G>
        <Path d="M100 60 Q97 46 103 33" stroke="#8A5A3B" strokeWidth={5} strokeLinecap="round" fill="none" />
        <Path d="M103 42 C112 30 130 29 137 37 C128 47 112 48 103 42 Z" fill={leaf} />
      </G>
    ),
  },
  orange: {
    colors: ['#FFD27A', '#FFAA45', '#F28C2A'],
    body: 'M100 46 C141 46 171 76 171 114 C171 152 141 181 100 181 C59 181 29 152 29 114 C29 76 59 46 100 46 Z',
    top: (leaf) => (
      <G>
        <Circle cx={100} cy={48} r={3.2} fill="#8BBF5A" />
        <Path d="M101 47 C107 36 121 34 128 40 C121 49 108 51 101 47 Z" fill={leaf} />
      </G>
    ),
    marks: (
      <G>
        {[
          [52, 84],
          [148, 84],
          [42, 116],
          [158, 116],
          [58, 154],
          [142, 154],
          [100, 170],
          [80, 62],
          [120, 64],
        ].map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} fill="#D9760F" opacity={0.25} />
        ))}
      </G>
    ),
  },
  pear: {
    colors: ['#E6F09E', '#C9DE6E', '#A9C852'],
    body: 'M100 40 C117 40 126 54 128 68 C130 84 148 96 160 116 C176 144 160 182 100 182 C40 182 24 144 40 116 C52 96 70 84 72 68 C74 54 83 40 100 40 Z',
    top: (leaf) => (
      <G>
        <Path d="M100 41 Q98 30 104 21" stroke="#8A5A3B" strokeWidth={4.5} strokeLinecap="round" fill="none" />
        <Path d="M103 29 C112 18 128 18 134 25 C126 34 111 35 103 29 Z" fill={leaf} />
      </G>
    ),
  },
  strawberry: {
    colors: ['#FF9DAA', '#F2566E', '#D63B57'],
    body: 'M100 54 C132 46 170 60 170 94 C170 130 136 168 100 184 C64 168 30 130 30 94 C30 60 68 46 100 54 Z',
    top: (leaf) => (
      <G>
        <Ellipse cx={82} cy={55} rx={17} ry={7} fill={leaf} transform="rotate(-20 82 55)" />
        <Ellipse cx={118} cy={55} rx={17} ry={7} fill={leaf} transform="rotate(20 118 55)" />
        <Ellipse cx={100} cy={49} rx={8} ry={13} fill={leaf} />
        <Path d="M100 42 Q99 33 103 25" stroke="#6FBF8C" strokeWidth={4} strokeLinecap="round" fill="none" />
      </G>
    ),
    marks: (
      <G>
        {[
          [56, 84],
          [144, 84],
          [44, 104],
          [156, 104],
          [100, 168],
          [84, 158],
          [116, 158],
          [70, 148],
          [130, 148],
          [74, 70],
          [126, 70],
        ].map(([x, y]) => (
          <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx={2} ry={3} fill="#FFE7A0" opacity={0.9} />
        ))}
      </G>
    ),
  },
  lemon: {
    colors: ['#FFF4A6', '#FFE45E', '#F2C932'],
    body: 'M26 112 C26 84 54 54 100 52 C146 54 174 84 174 112 C174 142 146 172 100 174 C54 172 26 142 26 112 Z',
    top: (leaf) => (
      <G>
        <Path d="M100 53 Q99 45 102 40" stroke="#8BBF5A" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d="M101 46 C109 36 123 35 129 41 C122 50 109 51 101 46 Z" fill={leaf} />
      </G>
    ),
    marks: (
      <G>
        <Path d="M29 103 C21 105 17 109 17 112 C17 115 21 119 29 121 Z" fill="#F2C932" />
        <Path d="M171 103 C179 105 183 109 183 112 C183 115 179 119 171 121 Z" fill="#F2C932" />
      </G>
    ),
  },
  blueberry: {
    colors: ['#B4C3FF', '#8392F0', '#6169D2'],
    body: 'M100 46 C141 46 171 76 171 114 C171 152 141 181 100 181 C59 181 29 152 29 114 C29 76 59 46 100 46 Z',
    top: () => (
      <Path
        d="M100 40 L103.5 47 L111 47.5 L105 52.5 L107 60 L100 56 L93 60 L95 52.5 L89 47.5 L96.5 47 Z"
        fill="#3E3F8F"
        opacity={0.75}
        strokeLinejoin="round"
      />
    ),
  },
  peach: {
    colors: ['#FFD9B8', '#FFB092', '#F28E8A'],
    body: 'M100 50 C141 46 172 74 172 114 C172 153 141 180 100 180 C59 180 28 153 28 114 C28 74 59 46 100 50 Z',
    top: (leaf) => (
      <G>
        <Path d="M100 51 Q99 41 103 33" stroke="#8A5A3B" strokeWidth={4.5} strokeLinecap="round" fill="none" />
        <Path d="M102 40 C94 28 78 27 71 34 C79 44 94 46 102 40 Z" fill={leaf} />
      </G>
    ),
    marks: <Path d="M100 52 C94 62 93 74 96 86" stroke="#E07A70" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.35} />,
  },
};

const CLASSIC_BODY = 'M100 44 C141 44 172 73 172 113 C172 153 141 180 100 180 C59 180 28 153 28 113 C28 73 59 44 100 44 Z';

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
  look,
  moodFace = false,
  style,
}: {
  size?: number;
  mood?: SolMood;
  /** Mood value 1-5 to tint Sol, or 0 for the default glow. */
  tint?: number;
  animated?: boolean;
  /** Arms and feet. On by default for larger Sols; small ones (avatars, the tab button) stay a simple face. */
  limbs?: boolean;
  /** A look to show instead of the person's own (the wardrobe's previews). */
  look?: SolLook;
  /** The face shows `mood` whatever the person chose, e.g. in mood pickers where the face is the answer. */
  moodFace?: boolean;
  style?: ViewStyle;
}) {
  const stored = useSolLook();
  const l = look ?? stored;
  const withLimbs = limbs ?? size >= 80;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fruit = l.fruit === 'classic' ? null : FRUIT[l.fruit];
  const [c1, c2, c3] = fruit?.colors ?? TINTS[tint] ?? TINTS[0]!;
  const eyes: EyeStyle = moodFace || l.eyes === 'auto' ? moodEyes(mood) : l.eyes;
  const mouth: MouthStyle = moodFace || l.mouth === 'auto' ? MOOD_MOUTH[mood] : l.mouth;
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
          {fruit ? (
            fruit.top(`url(#leaf${id})`)
          ) : (
            <G>
              {/* Sprout */}
              <Path d="M100 48 Q99 36 101 26" stroke="#6FBF8C" strokeWidth={4} strokeLinecap="round" fill="none" />
              <Path d="M100 33 C90 20 75 20 69 28 C78 38 92 39 100 33 Z" fill={`url(#leaf${id})`} />
              <Path d="M101 28 C110 13 127 12 134 20 C125 31 110 34 101 28 Z" fill={`url(#leaf${id})`} />
            </G>
          )}
          {/* Body */}
          <Path d={fruit?.body ?? CLASSIC_BODY} fill={`url(#body${id})`} />
          {fruit?.marks}
          <Ellipse cx={72} cy={74} rx={20} ry={10} fill="#FFFFFF" opacity={0.42} transform="rotate(-28 72 74)" />
          <Ellipse cx={140} cy={150} rx={14} ry={7} fill="#FFFFFF" opacity={0.18} transform="rotate(-30 140 150)" />
          <Cheeks style={l.cheeks} />
          <Eyes style={eyes} blink={blink} />
          <Mouth style={mouth} />
          <Glasses style={l.glasses} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
