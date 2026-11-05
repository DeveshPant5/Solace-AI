import { useEffect, useState } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

import type { PipMood } from '@/components/Pip';
import { PipGuide } from '@/components/PipGuide';
import { Row, T, Tappable } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { space, useTheme } from '@/theme';

/**
 * A first-visit tip from Pip: one short, calm line the first time someone
 * opens a screen. It sits inline (never over the content), never blocks
 * anything, and is marked as seen as soon as it shows, so it won't come back.
 */

export const TIPS = {
  practices: { line: 'This is your calm toolbox. When things feel heavy, a two-minute breather is a lovely place to start.', mood: 'calm' },
  journey: { line: 'This is where I grow. Every check-in and slow breath helps me bloom. There is no rush at all.', mood: 'happy' },
  sol: { line: 'This is where you and Sol talk. Say anything, big or small. Sol listens and remembers what matters.', mood: 'listening' },
  breathe: { line: 'Just follow the circle. Breathe in as it grows, and out as it softens. Nothing else to do.', mood: 'calm' },
  grounding: { line: 'Look around slowly. Tap once for each thing you notice. Take all the time you need.', mood: 'calm' },
  journal: { line: 'There are no right or wrong words here. Even one line is enough.', mood: 'listening' },
  checkin: { line: "Just notice how you feel right now. There's no wrong answer, and it only takes a moment.", mood: 'calm' },
  assessment: { line: 'A few gentle questions to notice patterns. It is not a test, and it is not a diagnosis.', mood: 'listening' },
  reminders: { line: 'Soft nudges, only when you want them. You can change or turn them off any time.', mood: 'happy' },
  memory: { line: "This is what Sol remembers about you. You're in charge here, and can remove anything, any time.", mood: 'calm' },
} satisfies Record<string, { line: string; mood: PipMood }>;

export type TipId = keyof typeof TIPS;

const seenThisSession = new Set<string>();

/** Forget which tips were seen, so they show again (used by the tour replay). */
export async function resetTips(userId: string) {
  seenThisSession.clear();
  await Promise.all((Object.keys(TIPS) as TipId[]).map((id) => storage.remove(`solace.tip.${userId}.${id}`)));
}

export function PipTip({ id, style }: { id: TipId; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const key = user ? `solace.tip.${user.id}.${id}` : null;

  useEffect(() => {
    if (!key) return;
    // Already shown once: don't show it again.
    if (seenThisSession.has(key)) return;
    let cancelled = false;
    void storage.get(key).then((v) => {
      if (cancelled || v === 'seen') return;
      seenThisSession.add(key);
      setShow(true);
      void storage.set(key, 'seen');
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!show) return null;
  const tip = TIPS[id];
  return (
    <Animated.View
      entering={FadeIn.duration(700).delay(250).easing(Easing.out(Easing.sin))}
      exiting={FadeOut.duration(450).easing(Easing.in(Easing.sin))}
      style={[{ marginBottom: space.lg }, style]}
    >
      <PipGuide line={tip.line} mood={tip.mood} size={64}>
        <Row style={{ justifyContent: 'flex-end', marginTop: space.sm, marginRight: -space.xl }}>
          <Tappable onPress={() => setShow(false)} hitSlop={10} accessibilityRole="button" style={{ paddingVertical: 4, paddingHorizontal: space.sm }}>
            <T variant="small" color={c.primary}>
              Got it
            </T>
          </Tappable>
        </Row>
      </PipGuide>
    </Animated.View>
  );
}
