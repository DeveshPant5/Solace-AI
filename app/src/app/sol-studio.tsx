import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Sol, type SolMood } from '@/components/Sol';
import { Button, Chip, Header, Row, Screen, SectionTitle, T, Tappable } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import {
  CHEEKS,
  CLASSIC_LOOK,
  EYES,
  FRUITS,
  GLASSES,
  isClassic,
  MOUTHS,
  randomLook,
  setSolLook,
  useSolLook,
  type SolLook,
} from '@/lib/solLook';
import { radius, space, useTheme } from '@/theme';

const MOODS: { mood: SolMood; label: string }[] = [
  { mood: 'joyful', label: 'Joyful' },
  { mood: 'happy', label: 'Happy' },
  { mood: 'calm', label: 'Calm' },
  { mood: 'thinking', label: 'Thinking' },
  { mood: 'sleepy', label: 'Sleepy' },
  { mood: 'concerned', label: 'Worried' },
];

const FACE_ZOOM = 132;

function OptionTile({ label, selected, onPress, children }: { label: string; selected: boolean; onPress: () => void; children: ReactNode }) {
  const c = useTheme();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{ alignItems: 'center', width: 86, gap: 6 }}
    >
      <View
        style={{
          width: 82,
          height: 82,
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? c.primarySoft : c.surface,
          borderWidth: 2,
          borderColor: selected ? c.primary : c.line,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
      <T variant="small" color={selected ? c.primary : c.inkSoft} numberOfLines={1} style={{ fontSize: 12 }}>
        {label}
      </T>
    </Tappable>
  );
}

/** One row of choices for one part of Luma, each shown on a little Luma of its own. */
function Shelf<K extends keyof SolLook>({
  title,
  part,
  options,
  look,
  mood,
  zoom = false,
}: {
  title: string;
  part: K;
  options: readonly { id: SolLook[K]; label: string }[];
  look: SolLook;
  mood: SolMood;
  /** Show just the face, close up, so small changes (eyes, mouth) are easy to tell apart. */
  zoom?: boolean;
}) {
  return (
    <>
      <SectionTitle title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.xl }}
        contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}
      >
        {options.map((o) => (
          <OptionTile key={String(o.id)} label={o.label} selected={look[part] === o.id} onPress={() => setSolLook({ ...look, [part]: o.id })}>
            {zoom ? (
              // Luma's face sits at about (50%, 57%) of the drawing; centre it in the tile.
              <View style={{ position: 'absolute', left: 39 - FACE_ZOOM / 2, top: 39 - FACE_ZOOM * 0.57 }}>
                <Sol size={FACE_ZOOM} mood={mood} look={{ ...look, [part]: o.id }} animated={false} limbs={false} />
              </View>
            ) : (
              <Sol size={70} mood={mood} look={{ ...look, [part]: o.id }} animated={false} limbs={false} />
            )}
          </OptionTile>
        ))}
      </ScrollView>
    </>
  );
}

/**
 * The secret wardrobe: hold Settings on the You tab for five seconds. Every
 * change shows on Luma everywhere straight away and stays on this phone.
 */
export default function SolStudio() {
  const c = useTheme();
  const look = useSolLook();
  const [mood, setMood] = useState<SolMood>('joyful');

  return (
    <Screen>
      <Header title="Luma’s wardrobe" />
      <Animated.View entering={FadeInDown.duration(500)}>
        <T variant="quote" color={c.inkSoft} center style={{ fontSize: 18, lineHeight: 26, marginTop: space.sm }}>
          You found a secret. Make Luma your own.
        </T>

        <LinearGradient
          colors={c.scheme === 'dark' ? ['#2C2723', '#26222E'] : ['#FDF0E2', '#F1ECFB']}
          style={{ borderRadius: radius.xl, alignItems: 'center', paddingVertical: space.xl, marginTop: space.lg, gap: space.md }}
        >
          <Sol size={180} mood={mood} />
          <Row gap={space.xs} style={{ flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: space.md }}>
            {MOODS.map((m) => (
              <Chip key={m.mood} label={m.label} selected={mood === m.mood} onPress={() => setMood(m.mood)} />
            ))}
          </Row>
        </LinearGradient>
      </Animated.View>

      <Shelf title="Fruit" part="fruit" options={FRUITS} look={look} mood={mood} />
      <Shelf title="Eyes" part="eyes" zoom options={EYES} look={look} mood={mood} />
      <Shelf title="Mouth" part="mouth" zoom options={MOUTHS} look={look} mood={mood} />
      <Shelf title="Cheeks" part="cheeks" zoom options={CHEEKS} look={look} mood={mood} />
      <Shelf title="Glasses" part="glasses" zoom options={GLASSES} look={look} mood={mood} />

      <Row gap={space.sm} style={{ marginTop: space.xxl }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Surprise me"
            kind="secondary"
            icon="shuffle"
            onPress={() => {
              haptic.success();
              setSolLook(randomLook());
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Classic Luma" kind="ghost" icon="rotate-ccw" disabled={isClassic(look)} onPress={() => setSolLook(CLASSIC_LOOK)} />
        </View>
      </Row>
    </Screen>
  );
}
