import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Platform, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { PipTip } from '@/components/PipTip';
import { Button, Card, ErrorNote, Header, IconBadge, IconButton, inputStyle, Row, Screen, SectionTitle, T, Tappable, type IconName } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import {
  notificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  syncReminders,
  type PermissionState,
} from '@/lib/notifications';
import type { ReminderItem } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { accent, radius, space, useTheme, type Accent } from '@/theme';

const KIND_STYLE: Record<ReminderItem['kind'], { icon: IconName; accent: Accent }> = {
  mood: { icon: 'heart', accent: 'rose' },
  affirmation: { icon: 'sun', accent: 'peach' },
  breathing: { icon: 'wind', accent: 'sky' },
  selfcare: { icon: 'coffee', accent: 'sage' },
  custom: { icon: 'bell', accent: 'butter' },
};

function TimeStepper({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const c = useTheme();
  const shift = (minutes: number) => {
    const total = (hour * 60 + minute + minutes + 1440) % 1440;
    haptic.tap();
    onChange(Math.floor(total / 60), total % 60);
  };
  return (
    <Row gap={space.sm} style={{ backgroundColor: c.sunken, borderRadius: radius.pill, paddingHorizontal: 4, paddingVertical: 2 }}>
      <Tappable onPress={() => shift(-15)} accessibilityLabel="15 minutes earlier" hitSlop={6} style={{ padding: 6 }}>
        <Feather name="minus" size={16} color={c.inkSoft} />
      </Tappable>
      <T variant="bodyStrong" style={{ minWidth: 76, textAlign: 'center' }}>
        {formatTime(hour, minute)}
      </T>
      <Tappable onPress={() => shift(15)} accessibilityLabel="15 minutes later" hitSlop={6} style={{ padding: 6 }}>
        <Feather name="plus" size={16} color={c.inkSoft} />
      </Tappable>
    </Row>
  );
}

export default function Reminders() {
  const c = useTheme();
  const { data, error, reload, setData } = useApi<{ reminders: ReminderItem[] }>('/reminders');
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [actionError, setActionError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState({ hour: 12, minute: 0 });
  const [adding, setAdding] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    void notificationPermission().then(setPermission);
  }, []);

  const resync = () => void syncReminders().catch(() => undefined);

  const patch = async (r: ReminderItem, changes: Partial<ReminderItem>) => {
    setActionError(null);
    setData((d) => (d ? { reminders: d.reminders.map((x) => (x.id === r.id ? { ...x, ...changes } : x)) } : d));
    try {
      await api(`/reminders/${r.id}`, { method: 'PATCH', body: changes });
      resync();
    } catch (e) {
      setActionError(errorMessage(e));
      void reload();
    }
  };

  const remove = async (r: ReminderItem) => {
    setData((d) => (d ? { reminders: d.reminders.filter((x) => x.id !== r.id) } : d));
    try {
      await api(`/reminders/${r.id}`, { method: 'DELETE' });
      resync();
    } catch (e) {
      setActionError(errorMessage(e));
      void reload();
    }
  };

  const add = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    setActionError(null);
    try {
      const { reminder } = await api<{ reminder: ReminderItem }>('/reminders', { body: { title: newTitle.trim(), ...newTime } });
      setData((d) => (d ? { reminders: [...d.reminders, reminder] } : d));
      setNewTitle('');
      haptic.success();
      resync();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const enable = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') resync();
    else if (result === 'denied') void Linking.openSettings();
  };

  return (
    <Screen>
      <Header title="Reminders" />
      <PipTip id="reminders" />

      {permission === 'unsupported' ? (
        <Card tone={c.butterSoft}>
          <T variant="small">Notifications work in the phone app. You can still set up reminders here, and they’ll arrive on your phone.</T>
        </Card>
      ) : permission !== 'granted' ? (
        <Card tone={c.butterSoft} style={{ gap: space.md }}>
          <Row gap={space.md}>
            <IconBadge icon="bell-off" bg={c.surface} fg={c.butter} />
            <T variant="small" style={{ flex: 1 }}>
              Notifications are off, so reminders can’t reach you yet.
            </T>
          </Row>
          <Button title={permission === 'denied' ? 'Open settings' : 'Turn on notifications'} small onPress={enable} />
        </Card>
      ) : null}

      {(error || actionError) && (
        <View style={{ marginTop: space.md }}>
          <ErrorNote message={(actionError ?? error)!} onRetry={error ? reload : undefined} />
        </View>
      )}

      <SectionTitle title="Your reminders" />
      <View style={{ gap: space.sm }}>
        {data?.reminders.map((r, i) => {
          const style = KIND_STYLE[r.kind];
          const a = accent(c, style.accent);
          return (
            <Animated.View key={r.id} entering={FadeInDown.delay(i * 40)} layout={LinearTransition}>
              <Card style={{ padding: space.lg, gap: space.md, opacity: r.enabled ? 1 : 0.7 }}>
                <Row gap={space.md}>
                  <IconBadge icon={style.icon} bg={a.soft} fg={a.strong} size={38} />
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">{r.title}</T>
                    {r.kind === 'affirmation' ? (
                      <T variant="small" color={c.inkSoft}>
                        A new affirmation each day
                      </T>
                    ) : r.body ? (
                      <T variant="small" color={c.inkSoft} numberOfLines={2}>
                        {r.body}
                      </T>
                    ) : null}
                    {r.createdBy === 'sol' && (
                      <T variant="small" color={c.primary} style={{ fontSize: 12 }}>
                        Set by Sol
                      </T>
                    )}
                  </View>
                  <Switch
                    value={r.enabled}
                    onValueChange={(enabled) => patch(r, { enabled })}
                    trackColor={{ true: c.primary, false: c.line }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel={`${r.title} reminder`}
                  />
                </Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <TimeStepper hour={r.hour} minute={r.minute} onChange={(hour, minute) => patch(r, { hour, minute })} />
                  {r.kind === 'custom' && <IconButton icon="trash-2" label="Delete reminder" tone="clear" size={34} onPress={() => remove(r)} />}
                </Row>
              </Card>
            </Animated.View>
          );
        })}
      </View>

      <SectionTitle title="Add your own" />
      <Card style={{ gap: space.md }}>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="e.g. Drink a glass of water"
          placeholderTextColor={c.inkFaint}
          style={inputStyle(c)}
          maxLength={60}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <TimeStepper hour={newTime.hour} minute={newTime.minute} onChange={(hour, minute) => setNewTime({ hour, minute })} />
          <Button title="Add" small icon="plus" onPress={add} loading={adding} disabled={!newTitle.trim()} />
        </Row>
        <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
          Tip: you can also ask Sol to remind you of something.
        </T>
      </Card>

      {Platform.OS !== 'web' && permission === 'granted' && (
        <Button
          title={testSent ? 'Test sent: arrives in 5 seconds' : 'Send a test notification'}
          kind="ghost"
          icon="send"
          style={{ marginTop: space.lg }}
          onPress={async () => setTestSent(await sendTestNotification())}
        />
      )}
    </Screen>
  );
}
