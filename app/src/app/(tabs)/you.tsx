import { Feather } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { replayTour } from '@/components/PipTour';
import { Sol } from '@/components/Sol';
import { Button, Card, IconBadge, Row, Screen, SectionTitle, T, Tappable, type IconName } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { space, useTheme } from '@/theme';

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

export default function You() {
  const c = useTheme();
  const { user, signOut } = useAuth();
  const memoryOn = user?.preferences.memoryEnabled !== false;

  return (
    <Screen tabBar>
      <View style={{ alignItems: 'center', gap: space.sm, marginTop: space.md }}>
        <Sol size={110} mood="happy" />
        <T variant="title">{user?.name}</T>
        <T variant="small" color={c.inkSoft}>
          {user?.email}
        </T>
        {user && (
          <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
            With Solace since {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </T>
        )}
      </View>

      <SectionTitle title="Your space" />
      <Card style={{ paddingVertical: space.sm }}>
        <MenuRow icon="sunrise" title="Daily tasks" href="/tasks" bg={c.sageSoft} fg={c.sage} />
        <MenuRow icon="bell" title="Reminders" href="/reminders" bg={c.butterSoft} fg={c.butter} />
        <MenuRow
          icon="bookmark"
          title="What Sol remembers"
          subtitle={memoryOn ? undefined : 'Memory is off'}
          href="/memory"
          bg={c.lavenderSoft}
          fg={c.primary}
        />
        <MenuRow icon="book-open" title="Journal" href="/journal" bg={c.peachSoft} fg={c.peach} />
        <MenuRow icon="sliders" title="Settings" href="/settings" bg={c.skySoft} fg={c.sky} />
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
