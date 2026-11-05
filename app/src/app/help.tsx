import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, View } from 'react-native';

import { Sol } from '@/components/Sol';
import { Button, Card, Header, IconBadge, Row, Screen, SectionTitle, T, Tappable } from '@/components/ui';
import { FIND_A_HELPLINE, HELPLINES, type HelpLine } from '@/content/wellness';
import { space, useTheme } from '@/theme';

function deviceZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

function Line({ line }: { line: HelpLine }) {
  const c = useTheme();
  return (
    <Card style={{ padding: space.lg }}>
      <Row gap={space.md}>
        <IconBadge icon={line.phone ? 'phone' : 'globe'} bg={c.roseSoft} fg={c.danger} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{line.name}</T>
          <T variant="small" color={c.inkSoft}>
            {line.detail}
          </T>
        </View>
        {line.phone ? (
          <Button title={`Call ${line.phone}`} small onPress={() => Linking.openURL(`tel:${line.phone}`)} />
        ) : line.url ? (
          <Button title="Open" small kind="secondary" onPress={() => WebBrowser.openBrowserAsync(line.url!)} />
        ) : null}
      </Row>
    </Card>
  );
}

export default function Help() {
  const c = useTheme();
  const zone = deviceZone();
  const local = HELPLINES.find((r) => r.zones.some((z) => (z.endsWith('/') ? zone.startsWith(z) : zone === z)));
  const others = HELPLINES.filter((r) => r !== local);

  return (
    <Screen>
      <Header title="Get support" />
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Sol size={110} mood="listening" />
        <T variant="title" center>
          You’re not alone
        </T>
        <T variant="body" color={c.inkSoft} center style={{ maxWidth: 330 }}>
          If you’re in danger or thinking about ending your life, please call your local emergency number or a crisis line now. Real people are ready to listen, any time.
        </T>
      </View>

      {local && (
        <>
          <SectionTitle title={`In ${local.region}`} />
          <View style={{ gap: space.sm }}>
            {local.lines.map((l) => (
              <Line key={l.name} line={l} />
            ))}
          </View>
        </>
      )}

      <SectionTitle title="Anywhere in the world" />
      <Line line={FIND_A_HELPLINE} />

      {others.map((region) => (
        <View key={region.region}>
          <T variant="subheading" style={{ marginTop: space.xl, marginBottom: space.sm }}>
            {region.region}
          </T>
          <View style={{ gap: space.sm }}>
            {region.lines.map((l) => (
              <Line key={l.name} line={l} />
            ))}
          </View>
        </View>
      ))}

      <SectionTitle title="Right now, you could" />
      <View style={{ gap: space.sm }}>
        {[
          { icon: 'users' as const, text: 'Message or call someone you trust and tell them how you’re feeling.' },
          { icon: 'map-pin' as const, text: 'Go somewhere safe, or where other people are around.' },
          { icon: 'wind' as const, text: 'Slow your breathing: in for 4, out for 6.' },
        ].map((tip) => (
          <Row key={tip.text} gap={space.md} style={{ alignItems: 'flex-start' }}>
            <Feather name={tip.icon} size={18} color={c.primary} style={{ marginTop: 3 }} />
            <T variant="body" style={{ flex: 1 }}>
              {tip.text}
            </T>
          </Row>
        ))}
      </View>
      <Tappable onPress={() => router.push('/breathe/calm')} style={{ marginTop: space.xl }}>
        <T variant="small" color={c.primary} center>
          Open calm breathing
        </T>
      </Tappable>
    </Screen>
  );
}
