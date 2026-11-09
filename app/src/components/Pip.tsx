import { useEffect, useId, useRef, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * Pip: a little walking flower pot, the seedling Luma planted for you.
 *
 * The plant on top grows as the person takes care of themselves:
 *   onboarding  0 shoot · 1 sprout · 2 seedling · 3 bud · 4 flower · 5 sapling · 6 young tree
 *   in the app  7-10: a tree that fills out, then blossoms, then bears fruit (by garden level)
 * When the stage changes, the new growth fades up from the soil.
 *
 * Everything about Pip is meant to calm: a slow breathing sway (about
 * 12 breaths a minute), leaves that drift, an unhurried wave, and no
 * motion at all when the phone asks for reduced motion.
 */
export type PipMood = 'happy' | 'calm' | 'curious' | 'listening' | 'cheering' | 'thinking';

const INK = '#3B2A22';
const LIMB = '#C9714D';
const HAND = '#F4B595';
const SHOE = '#7A4E3A';
const BARK = '#8B6346';
const W = 240;
const H = 290;
export const MAX_STAGE = 10;
/** Onboarding ends as a young tree; entering the app makes Pip a tree. */
export const ONBOARDING_LAST_STAGE = 6;

/** How far the drawing reaches above the pot for each stage (top of the viewBox). */
const TOP = [0, 0, 0, 0, 0, 0, -14, -40, -64, -92, -92];

/** Garden level (1-9) → Pip's tree inside the app (7 young tree … 10 tree with fruit). */
export function pipStage(level: number | null | undefined): number {
  const l = level ?? 1;
  if (l <= 2) return 7;
  if (l <= 4) return 8;
  if (l <= 6) return 9;
  return 10;
}

const clampStage = (s: number) => Math.max(0, Math.min(MAX_STAGE, Math.round(s)));

type MouthShape = 'open' | 'mid' | 'closed';

// ---------- The plant ----------

const fmt = (n: number) => Math.round(n * 10) / 10;

function leafLeft(y: number, s: number) {
  const p = (x: number, yy: number) => `${fmt(120 + x * s)} ${fmt(y + yy * s)}`;
  return `M${p(0, 0)} C${p(-16, -18)} ${p(-36, -16)} ${p(-40, -6)} C${p(-28, 6)} ${p(-10, 8)} ${p(0, 0)} Z`;
}
function leafRight(y: number, s: number) {
  const p = (x: number, yy: number) => `${fmt(120 + x * s)} ${fmt(y + yy * s)}`;
  return `M${p(1, -6)} C${p(16, -26)} ${p(38, -26)} ${p(42, -16)} C${p(30, -2)} ${p(12, 2)} ${p(1, -6)} Z`;
}

function Flower({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <G>
      {[0, 72, 144, 216, 288].map((a) => (
        <Ellipse key={a} cx={cx} cy={cy - r} rx={r * 0.62} ry={r} fill={color} transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
      <Circle cx={cx} cy={cy} r={r * 0.55} fill="#F4CD6C" />
    </G>
  );
}

function trunkPath(bw: number, tw: number, yTop: number) {
  const mid = (106 + yTop) / 2;
  return `M${120 - bw} 106 C${fmt(120 - bw * 0.8)} ${fmt(mid)} ${120 - tw - 1} ${yTop + 10} ${120 - tw} ${yTop} L${120 + tw} ${yTop} C${120 + tw + 1} ${yTop + 10} ${fmt(120 + bw * 0.8)} ${fmt(mid)} ${120 + bw} 106 Z`;
}

/** Leafy clumps of the canopy, relative to its centre, at full size. */
const CANOPY: [number, number, number][] = [
  [0, 0, 46],
  [-34, 18, 32],
  [34, 18, 32],
  [-22, -24, 30],
  [22, -24, 30],
  [0, -38, 28],
];
const BLOSSOMS: [number, number][] = [
  [-20, -30],
  [18, -12],
  [-36, 10],
  [30, 16],
  [4, -46],
  [-6, 10],
  [36, -18],
];
const FRUIT: [number, number][] = [
  [-24, 22],
  [24, 28],
  [8, -22],
  [-40, -4],
];

function Tree({ stage, canopy }: { stage: number; canopy: string }) {
  // Young tree on sign-up (6), then fuller, then blossoms (9), then fruit (10).
  const s = [0.5, 0.68, 0.84, 1, 1][stage - 6]!;
  const cy = [30, 16, 2, -14, -14][stage - 6]!;
  const bw = [5, 7, 8, 9, 9][stage - 6]!;
  const tw = bw / 2;
  const trunkTop = cy + 26 * s;
  return (
    <G>
      <Path d={trunkPath(bw, tw, trunkTop)} fill={BARK} />
      <Path d={`M120 ${fmt(trunkTop + 22)} L${fmt(120 - 20 * s)} ${fmt(trunkTop + 4)}`} stroke={BARK} strokeWidth={fmt(2 + 2 * s)} strokeLinecap="round" />
      <Path d={`M120 ${fmt(trunkTop + 14)} L${fmt(120 + 22 * s)} ${fmt(trunkTop - 2)}`} stroke={BARK} strokeWidth={fmt(2 + 2 * s)} strokeLinecap="round" />
      {/* Canopy: a soft shadow layer, the leaves, then a few highlights. */}
      {CANOPY.map(([x, y, r], i) => (
        <Circle key={`s${i}`} cx={fmt(120 + x * s)} cy={fmt(cy + y * s + 4)} r={fmt(r * s)} fill="#4E8A5E" />
      ))}
      {CANOPY.map(([x, y, r], i) => (
        <Circle key={`c${i}`} cx={fmt(120 + x * s)} cy={fmt(cy + y * s)} r={fmt(r * s)} fill={canopy} />
      ))}
      <Circle cx={fmt(120 - 18 * s)} cy={fmt(cy - 26 * s)} r={fmt(11 * s)} fill="#FFFFFF" opacity={0.2} />
      <Circle cx={fmt(120 - 34 * s)} cy={fmt(cy + 6 * s)} r={fmt(7 * s)} fill="#FFFFFF" opacity={0.14} />
      {stage >= 9 && BLOSSOMS.map(([x, y], i) => <Flower key={`b${i}`} cx={fmt(120 + x * s)} cy={fmt(cy + y * s)} r={4.6} color="#F7A9C0" />)}
      {stage >= 10 &&
        FRUIT.map(([x, y], i) => (
          <G key={`f${i}`}>
            <Circle cx={fmt(120 + x)} cy={fmt(cy + y)} r={6.5} fill="#FFB36B" />
            <Circle cx={fmt(118 + x)} cy={fmt(cy + y - 2)} r={2} fill="#FFFFFF" opacity={0.5} />
          </G>
        ))}
    </G>
  );
}

function Sapling({ leaf }: { leaf: string }) {
  return (
    <G>
      <Path d={trunkPath(3.5, 1.8, 30)} fill="#8E7A50" />
      <Path d={leafLeft(88, 0.8)} fill={leaf} />
      <Path d={leafRight(84, 0.8)} fill={leaf} />
      <Path d={leafLeft(68, 0.72)} fill={leaf} />
      <Path d={leafRight(64, 0.72)} fill={leaf} />
      <Path d={leafLeft(48, 0.62)} fill={leaf} />
      <Path d={leafRight(46, 0.62)} fill={leaf} />
      <Circle cx={120} cy={26} r={13} fill={leaf} />
      <Circle cx={108} cy={34} r={10} fill={leaf} />
      <Circle cx={132} cy={34} r={10} fill={leaf} />
    </G>
  );
}

function Plant({ stage, leaf, canopy }: { stage: number; leaf: string; canopy: string }) {
  if (stage >= 6) return <Tree stage={stage} canopy={canopy} />;
  if (stage === 5) return <Sapling leaf={leaf} />;
  const top = [82, 70, 58, 50, 46][stage]!;
  const stemPath = `M120 104 C118 ${fmt((104 + top) / 2 + 6)} 121 ${fmt((104 + top) / 2 - 4)} 120 ${top}`;
  return (
    <G>
      <Path d={stemPath} stroke="#5E9F6E" strokeWidth={stage === 0 ? 4 : 5} strokeLinecap="round" fill="none" />
      {stage === 0 && (
        <G>
          <Path d={leafLeft(91, 0.72)} fill={leaf} />
          <Path d={leafRight(89, 0.72)} fill={leaf} />
        </G>
      )}
      {stage >= 1 && (
        <G>
          <Path d={leafLeft(stage === 1 ? 80 : 90, stage === 1 ? 1 : 0.85)} fill={leaf} />
          <Path d={leafRight(stage === 1 ? 74 : 86, stage === 1 ? 1 : 0.85)} fill={leaf} />
        </G>
      )}
      {stage >= 2 && (
        <G>
          <Path d={leafLeft(stage === 2 ? 66 : 70, 0.8)} fill={leaf} />
          <Path d={leafRight(stage === 2 ? 64 : 68, 0.8)} fill={leaf} />
        </G>
      )}
      {stage === 3 && (
        <G>
          <Ellipse cx={120} cy={44} rx={8.5} ry={11.5} fill="#F39BB6" />
          <Path d="M113 48 Q120 56 127 48 Q120 51 113 48 Z" fill="#7CB98A" />
        </G>
      )}
      {stage === 4 && <Flower cx={120} cy={40} r={13} color="#FFB59E" />}
    </G>
  );
}

function PlantSvg({ stage, size, height, y0, id }: { stage: number; size: number; height: number; y0: number; id: string }) {
  return (
    <Svg width={size} height={height} viewBox={`0 ${y0} ${W} ${H - y0}`}>
      <Defs>
        <LinearGradient id={`leaf${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B5E6BF" />
          <Stop offset="1" stopColor="#5E9F6E" />
        </LinearGradient>
        <LinearGradient id={`canopy${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#A6DDB0" />
          <Stop offset="1" stopColor="#66A877" />
        </LinearGradient>
      </Defs>
      <Plant stage={stage} leaf={`url(#leaf${id})`} canopy={`url(#canopy${id})`} />
    </Svg>
  );
}

// ---------- The face ----------

function Eyes({ mood, blink }: { mood: PipMood; blink: boolean }) {
  const stroke = { stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' as const, fill: 'none' };
  if (mood === 'cheering') {
    return (
      <G>
        <Path d="M89 175 Q98 163 107 175" {...stroke} />
        <Path d="M133 175 Q142 163 151 175" {...stroke} />
      </G>
    );
  }
  if (mood === 'calm') {
    // Softly closed, content eyes.
    return (
      <G>
        <Path d="M89 170 Q98 178 107 170" {...stroke} />
        <Path d="M133 170 Q142 178 151 170" {...stroke} />
      </G>
    );
  }
  const ry = blink ? 1.4 : 10.5;
  const look = mood === 'thinking' ? -2.5 : 0;
  return (
    <G>
      <Ellipse cx={98 + look} cy={172 + look} rx={8.5} ry={ry} fill={INK} />
      <Ellipse cx={142 + look} cy={172 + look} rx={8.5} ry={ry} fill={INK} />
      {!blink && (
        <G>
          <Circle cx={101 + look} cy={167.5 + look} r={3.2} fill="#FFFFFF" />
          <Circle cx={145 + look} cy={167.5 + look} r={3.2} fill="#FFFFFF" />
          <Circle cx={95.5 + look} cy={177 + look} r={1.5} fill="#FFFFFF" opacity={0.8} />
          <Circle cx={139.5 + look} cy={177 + look} r={1.5} fill="#FFFFFF" opacity={0.8} />
        </G>
      )}
      {mood === 'curious' && <Path d="M133 154 Q142 149 152 153" {...stroke} strokeWidth={3.5} />}
      {mood === 'thinking' && <Path d="M88 155 Q96 151 105 154" {...stroke} strokeWidth={3.5} />}
    </G>
  );
}

function Mouth({ mood, talking }: { mood: PipMood; talking: MouthShape | null }) {
  const stroke = { stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' as const, fill: 'none' };
  if (talking) {
    if (talking === 'closed') return <Path d="M111 195 Q120 202 129 195" {...stroke} />;
    return (
      <G>
        <Ellipse cx={120} cy={197} rx={talking === 'open' ? 7.5 : 6.5} ry={talking === 'open' ? 7 : 4.2} fill={INK} />
        {talking === 'open' && <Ellipse cx={120} cy={200.5} rx={4} ry={2.3} fill="#F28C8C" />}
      </G>
    );
  }
  switch (mood) {
    case 'cheering':
      return (
        <G>
          <Path d="M106 189 Q120 211 134 189 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Ellipse cx={120} cy={200} rx={5.5} ry={3} fill="#F28C8C" />
        </G>
      );
    case 'happy':
      return (
        <G>
          <Path d="M108 190 Q120 206 132 190 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Ellipse cx={120} cy={199} rx={4.5} ry={2.4} fill="#F28C8C" />
        </G>
      );
    case 'calm':
      return <Path d="M111 193 Q120 200 129 193" {...stroke} />;
    case 'curious':
      return <Ellipse cx={120} cy={196} rx={5} ry={6} fill={INK} />;
    case 'listening':
      return <Path d="M110 193 Q120 201 130 193" {...stroke} />;
    case 'thinking':
      return <Path d="M112 197 Q121 196 129 192" {...stroke} />;
  }
}

// ---------- Pip ----------

const GROW_MS = 1100;

export function Pip({
  size = 120,
  mood = 'happy',
  stage: stageProp = 1,
  growFrom,
  speaking = false,
  wave = false,
  animated = true,
  style,
}: {
  /** Width in points; Pip gets taller as the plant grows. */
  size?: number;
  mood?: PipMood;
  /** How grown the plant is, 0-10 (see the top of this file). */
  stage?: number;
  /** Start from this stage and grow into `stage` when Pip first appears. */
  growFrom?: number;
  /** Moves the mouth, for while Pip's voice is playing. */
  speaking?: boolean;
  /** A slow, friendly wave with the right hand. */
  wave?: boolean;
  animated?: boolean;
  style?: ViewStyle;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduceMotion = useReducedMotion();
  const moving = animated && !reduceMotion;
  const stage = clampStage(stageProp);

  // Growth: the old plant fades away while the new one rises from the soil.
  const [shown, setShown] = useState(growFrom !== undefined && moving ? clampStage(growFrom) : stage);
  const [previous, setPrevious] = useState<number | null>(null);
  const grow = useSharedValue(1);
  const growTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstGrowth = useRef(true);

  useEffect(() => {
    if (stage === shown) return;
    if (!moving) {
      setShown(stage);
      setPrevious(null);
      return;
    }
    // On first appearance with growFrom, wait a moment so the change is seen.
    const delay = firstGrowth.current && growFrom !== undefined ? 700 : 0;
    firstGrowth.current = false;
    const start = setTimeout(() => {
      setPrevious(shown);
      setShown(stage);
      grow.value = 0;
      grow.value = withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.sin) });
      if (growTimer.current) clearTimeout(growTimer.current);
      growTimer.current = setTimeout(() => setPrevious(null), GROW_MS + 50);
    }, delay);
    return () => clearTimeout(start);
  }, [stage, moving]);

  useEffect(() => () => {
    if (growTimer.current) clearTimeout(growTimer.current);
  }, []);

  const y0 = Math.min(TOP[shown]!, previous === null ? 0 : TOP[previous]!);
  const total = H - y0;
  const height = (size * total) / W;
  const pct = (y: number) => `${fmt(((y - y0) / total) * 100)}%`;

  const [blink, setBlink] = useState(false);
  const [talk, setTalk] = useState<MouthShape | null>(null);
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const arm = useSharedValue(0);

  // Breathing: 2.5 s in, 2.5 s out. Slow enough to breathe along with.
  useEffect(() => {
    if (!moving) {
      breath.value = 0;
      sway.value = 0;
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    breath.value = withRepeat(withSequence(withTiming(1, { duration: 2500, easing: ease }), withTiming(0, { duration: 2500, easing: ease })), -1);
    sway.value = withRepeat(withSequence(withTiming(1, { duration: 3600, easing: ease }), withTiming(-1, { duration: 3600, easing: ease })), -1, true);
    return () => {
      cancelAnimation(breath);
      cancelAnimation(sway);
    };
  }, [moving, breath, sway]);

  // Arm: resting at the side, or a slow wave (0.8 s per swing), or held up when cheering.
  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    if (wave && moving) {
      arm.value = withTiming(-100, { duration: 600, easing: ease }, () => {
        arm.value = withRepeat(withSequence(withTiming(-118, { duration: 800, easing: ease }), withTiming(-88, { duration: 800, easing: ease })), -1, true);
      });
      return () => cancelAnimation(arm);
    }
    arm.value = withTiming(wave || mood === 'cheering' ? -100 : 0, { duration: moving ? 500 : 0, easing: ease });
  }, [wave, moving, mood, arm]);

  useEffect(() => {
    if (!moving) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        timer = setTimeout(() => {
          setBlink(false);
          schedule();
        }, 150);
      }, 3200 + Math.random() * 3200);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [moving]);

  // Lip movement while the voice plays: an easy, unhurried rhythm.
  useEffect(() => {
    if (!speaking) {
      setTalk(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const shapes: MouthShape[] = ['open', 'mid', 'open', 'closed', 'mid'];
    const tick = () => {
      setTalk(shapes[Math.floor(Math.random() * shapes.length)]!);
      timer = setTimeout(tick, 130 + Math.random() * 90);
    };
    tick();
    return () => clearTimeout(timer);
  }, [speaking]);

  // Trees are taller; let them sway a little less.
  const swayDeg = shown >= 6 ? 1.6 : 3;
  const body = useAnimatedStyle(() => ({
    transform: [{ translateY: -breath.value * size * 0.012 }, { scaleY: 1 + breath.value * 0.022 }, { scaleX: 1 - breath.value * 0.008 }],
  }));
  const plantSway = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value * swayDeg}deg` }] }), [swayDeg]);
  const newGrowth = useAnimatedStyle(() => ({ opacity: grow.value, transform: [{ scale: 0.82 + grow.value * 0.18 }] }));
  const oldGrowth = useAnimatedStyle(() => ({ opacity: 1 - grow.value }));
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${arm.value}deg` }] }));

  const layer = { position: 'absolute' as const, left: 0, top: 0, width: size, height };
  const base = `50% ${pct(104)}`;
  const viewBox = `0 ${y0} ${W} ${total}`;

  return (
    <View style={[{ width: size, height }, style]} accessibilityRole="image" accessibilityLabel={shown >= 6 ? 'Pip, your little tree' : 'Pip, your little sprout'}>
      <Animated.View style={[{ width: size, height, transformOrigin: `50% ${pct(270)}` }, body]}>
        <Svg width={size} height={height} viewBox={viewBox}>
          <Defs>
            <LinearGradient id={`ppot${id}`} x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor="#F3A57F" />
              <Stop offset="1" stopColor="#D9774F" />
            </LinearGradient>
          </Defs>
          <Ellipse cx={120} cy={277} rx={68} ry={7} fill="#000000" opacity={0.06} />
          {/* Legs and shoes */}
          <Path d="M98 236 L98 254" stroke={LIMB} strokeWidth={13} strokeLinecap="round" />
          <Path d="M142 236 L142 254" stroke={LIMB} strokeWidth={13} strokeLinecap="round" />
          <Ellipse cx={92} cy={260} rx={17} ry={9.5} fill={SHOE} />
          <Ellipse cx={148} cy={260} rx={17} ry={9.5} fill={SHOE} />
          <Ellipse cx={96} cy={257} rx={7} ry={3} fill="#FFFFFF" opacity={0.3} />
          <Ellipse cx={144} cy={257} rx={7} ry={3} fill="#FFFFFF" opacity={0.3} />
          {/* Left arm, resting */}
          <Path d="M56 160 Q34 168 26 196" stroke={LIMB} strokeWidth={13} strokeLinecap="round" fill="none" />
          <Circle cx={26} cy={196} r={11} fill={HAND} />
          {/* The pot */}
          <Path d="M50 130 L190 130 L176 234 Q174 246 162 246 L78 246 Q66 246 64 234 Z" fill={`url(#ppot${id})`} />
          <Rect x={38} y={100} width={164} height={34} rx={13} fill="#F4B595" />
          <Rect x={46} y={104} width={70} height={7} rx={3.5} fill="#FFFFFF" opacity={0.45} />
          <Ellipse cx={120} cy={103} rx={70} ry={7} fill="#6B4A3A" />
          <Path d="M70 226 Q120 236 170 226" stroke="#FFFFFF" strokeWidth={3} opacity={0.25} fill="none" strokeLinecap="round" />
          {/* Cheeks */}
          <Ellipse cx={75} cy={189} rx={10} ry={6.5} fill="#FF8F9E" opacity={0.38} />
          <Ellipse cx={165} cy={189} rx={10} ry={6.5} fill="#FF8F9E" opacity={0.38} />
          <Eyes mood={mood} blink={blink} />
          <Mouth mood={mood} talking={talk} />
        </Svg>

        {/* The plant drifts a little, like leaves in a slow breeze. */}
        <Animated.View pointerEvents="none" style={[layer, { transformOrigin: base }, plantSway]}>
          {previous !== null && (
            <Animated.View style={[layer, oldGrowth]}>
              <PlantSvg stage={previous} size={size} height={height} y0={y0} id={`o${id}`} />
            </Animated.View>
          )}
          <Animated.View style={[layer, { transformOrigin: base }, previous !== null ? newGrowth : undefined]}>
            <PlantSvg stage={shown} size={size} height={height} y0={y0} id={`n${id}`} />
          </Animated.View>
        </Animated.View>

        {/* Right arm in its own layer so it can wave from the shoulder. */}
        <Animated.View pointerEvents="none" style={[layer, { transformOrigin: `76.7% ${pct(158)}` }, armStyle]}>
          <Svg width={size} height={height} viewBox={viewBox}>
            <Path d="M184 158 Q206 166 214 194" stroke={LIMB} strokeWidth={13} strokeLinecap="round" fill="none" />
            <Circle cx={214} cy={194} r={11} fill={HAND} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
