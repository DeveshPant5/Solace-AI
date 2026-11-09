import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { HandIcon } from '@/components/HandIcon';
import { LumaDance } from '@/components/LumaDance';
import { replayTour } from '@/components/PipTour';
import { Sol } from '@/components/Sol';
import { Button, Card, IconBadge, Row, Screen, SectionTitle, T, Tappable, type IconName } from '@/components/ui';
import { FOCUS_AREAS } from '@/content/wellness';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import type { ProgressData } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { fonts, radius, space, useTheme } from '@/theme';

function MenuRow({
  icon,
  title,
  subtitle,
  href,
  onPress,
  bg,
  fg,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  href?: Href;
  onPress?: () => void;
  bg: string;
  fg: string;
}) {
  const c = useTheme();
  return (
    <Tappable onPress={() => (onPress ? onPress() : href && router.push(href))} style={{ paddingVertical: space.md }} accessibilityRole="button">
      <Row gap={space.md}>
        <IconBadge icon={icon} bg={bg} fg={fg} size={38} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{title}</T>
          {subtitle && (
            <T variant="small" color={c.inkSoft}>
              {subtitle}
            </T>
          )}
        </View>
        <Feather name="chevron-right" size={20} color={c.inkFaint} />
      </Row>
    </Tappable>
  );
}

/** A few faint hand-drawn sparkles and a leaf, so the card feels drawn on rather than printed. */
function Doodles({ color }: { color: string }) {
  const sparkle = (x: number, y: number, r: number) =>
    `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 340 260" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={sparkle(300, 34, 9)} fill={color} opacity={0.35} />
      <Path d={sparkle(322, 62, 5)} fill={color} opacity={0.25} />
      <Path d={sparkle(276, 18, 4)} fill={color} opacity={0.22} />
      <Path d={sparkle(26, 232, 6)} fill={color} opacity={0.22} />
      <Path d="M318 214c-14-2-24 6-26 20 14 2 24-6 26-20z" fill={color} opacity={0.14} />
      <Path d="M292 234c8-7 15-12 24-18" stroke={color} strokeWidth={1.6} strokeLinecap="round" opacity={0.25} fill="none" />
    </Svg>
  );
}

/** A soft pencil line between the card's parts. */
function Squiggle({ color }: { color: string }) {
  return (
    <Svg width="100%" height={10} viewBox="0 0 300 10" preserveAspectRatio="none" style={{ marginVertical: space.lg }}>
      <Path
        d="M2 5.5C22 2 38 8.5 60 5.2S100 2.4 122 5.6 164 8.2 186 5S228 2.2 250 5.4 284 7.6 298 4.8"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.45}
      />
    </Svg>
  );
}

function Stat({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <HandIcon name={icon} size={22} color={color} />
      <Text style={{ fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: c.ink }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <T variant="small" color={c.inkSoft} center style={{ fontSize: 12, lineHeight: 15 }} numberOfLines={2}>
        {label}
      </T>
    </View>
  );
}

function greetingFor(hour: number) {
  if (hour < 5) return 'Still up,';
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

/** Who you are here: Luma, your name, your time together, a few gentle numbers and what you're tending to. */
function ProfileCard() {
  const c = useTheme();
  const { user } = useAuth();
  const { data: progress } = useApi<ProgressData>('/progress');
  if (!user) return null;

  const days = Math.max(1, Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000) + 1);
  const moments = progress ? progress.counts.checkins + progress.counts.breathing + progress.counts.grounding + progress.counts.journal : null;
  const focus = (user.profile.focus ?? [])
    .map((id) => FOCUS_AREAS.find((f) => f.id === id))
    .filter((f): f is (typeof FOCUS_AREAS)[number] => !!f)
    .slice(0, 4);
  const since = new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <LinearGradient
      colors={c.scheme === 'dark' ? ['#2E2722', '#2A2430', '#232026'] : ['#FCE9D9', '#F9EFE6', '#F1ECF9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.xl, padding: space.xl, marginTop: space.md, overflow: 'hidden' }}
    >
      <Doodles color={c.peach} />
      <Row gap={space.lg}>
        <Sol size={96} mood="happy" />
        <View style={{ flex: 1 }}>
          <T variant="small" color={c.inkSoft}>
            {greetingFor(new Date().getHours())}
          </T>
          <T variant="title" numberOfLines={1} adjustsFontSizeToFit>
            {user.name}
          </T>
          <T variant="small" color={c.inkSoft} numberOfLines={1}>
            {user.email}
          </T>
        </View>
      </Row>

      <Squiggle color={c.inkFaint} />

      <Row style={{ alignItems: 'flex-start' }}>
        <Stat icon="sun" value={days} label={days === 1 ? 'day together' : 'days together'} color={c.peach} />
        <Stat icon="heart" value={moments ?? '·'} label={moments === 1 ? 'calm moment' : 'calm moments'} color={c.rose} />
        <Stat icon="sprout" value={progress?.name ?? '·'} label="Pip’s garden" color={c.sage} />
      </Row>

      {focus.length > 0 && (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <T variant="small" color={c.inkSoft} center>
            Tending to
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {focus.map((f) => (
              <Row
                key={f.id}
                gap={5}
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: radius.pill,
                  backgroundColor: c.scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.7)',
                }}
              >
                <HandIcon name={f.icon} size={15} color={c.inkSoft} />
                <T variant="small" style={{ fontSize: 13 }}>
                  {f.label}
                </T>
              </Row>
            ))}
          </Row>
        </View>
      )}

      <T variant="small" color={c.inkFaint} center style={{ fontSize: 12, marginTop: space.lg }}>
        With Solace since {since}
      </T>
    </LinearGradient>
  );
}

const HOLD_MS = 5000;

/**
 * Settings, with a secret: holding it for five seconds makes Luma dance and ask
 * to be dressed up, then opens Luma's wardrobe. While it's held the icon slowly
 * turns and a soft tick comes each second; a short tap just opens Settings.
 */
function SettingsRow() {
  const c = useTheme();
  const [dancing, setDancing] = useState(false);
  const turn = useSharedValue(0);
  const ticks = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTicks = () => {
    if (ticks.current) clearInterval(ticks.current);
    ticks.current = null;
  };
  useEffect(() => stopTicks, []);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }, { scale: 1 + turn.value * 0.18 }] }));

  return (
    <>
      <Tappable
        onPress={() => router.push('/settings')}
        onPressIn={() => {
          turn.value = withTiming(1, { duration: HOLD_MS, easing: Easing.in(Easing.quad) });
          let second = 0;
          stopTicks();
          ticks.current = setInterval(() => {
            second++;
            if (second >= 2 && second < 5) haptic.tap();
          }, 1000);
        }}
        onPressOut={() => {
          stopTicks();
          turn.value = withTiming(0, { duration: 400 });
        }}
        onLongPress={() => {
          stopTicks();
          haptic.success();
          setDancing(true);
        }}
        delayLongPress={HOLD_MS}
        style={{ paddingVertical: space.md }}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Row gap={space.md}>
          <Animated.View style={iconStyle}>
            <IconBadge icon="sliders" bg={c.skySoft} fg={c.sky} size={38} />
          </Animated.View>
          <T variant="bodyStrong" style={{ flex: 1 }}>
            Settings
          </T>
          <Feather name="chevron-right" size={20} color={c.inkFaint} />
        </Row>
      </Tappable>
      <LumaDance
        visible={dancing}
        onDone={() => {
          setDancing(false);
          router.push('/sol-studio');
        }}
      />
    </>
  );
}

export default function You() {
  const c = useTheme();
  const { user, signOut } = useAuth();
  const memoryOn = user?.preferences.memoryEnabled !== false;

  return (
    <Screen tabBar>
      <ProfileCard />

      <SectionTitle title="Your space" />
      <Card style={{ paddingVertical: space.sm }}>
        <MenuRow icon="sunrise" title="Daily tasks" href="/tasks" bg={c.sageSoft} fg={c.sage} />
        <MenuRow icon="bell" title="Reminders" href="/reminders" bg={c.butterSoft} fg={c.butter} />
        <MenuRow
          icon="bookmark"
          title="What Luma remembers"
          subtitle={memoryOn ? undefined : 'Memory is off'}
          href="/memory"
          bg={c.lavenderSoft}
          fg={c.primary}
        />
        <MenuRow icon="book-open" title="Journal" href="/journal" bg={c.peachSoft} fg={c.peach} />
        <SettingsRow />
      </Card>

      <SectionTitle title="Support" />
      <Card style={{ paddingVertical: space.sm }}>
        <MenuRow icon="life-buoy" title="Get support now" href="/help" bg={c.roseSoft} fg={c.danger} />
        <MenuRow
          icon="compass"
          title="Take the tour with Pip"
          onPress={() => {
            if (user) void replayTour(user.id).then(() => router.navigate('/'));
          }}
          bg={c.sageSoft}
          fg={c.sage}
        />
      </Card>

      <Card tone={c.sunken} style={{ marginTop: space.xl, gap: space.sm }}>
        <Row gap={8}>
          <Feather name="shield" size={16} color={c.inkSoft} />
          <T variant="bodyStrong">Your privacy</T>
        </Row>
        <T variant="small" color={c.inkSoft}>
          Everything you share stays private to your account, and you can delete it any time. Replies come from Groq’s open AI models; Pip’s voice uses ElevenLabs.
        </T>
      </Card>

      <Button
        title="Sign out"
        kind="secondary"
        icon="log-out"
        style={{ marginTop: space.xl }}
        onPress={async () => {
          if (await confirm('Sign out?', 'Your reminders on this phone will stop until you sign back in.', 'Sign out', false)) await signOut();
        }}
      />
    </Screen>
  );
}
