import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ChoiceChip, DayPicker, TimePicker } from '@/components/TaskBits';
import { Button, Card, ErrorNote, Header, inputStyle, Row, Screen, SectionTitle, T, Tappable } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { requestNotificationPermission, syncReminders } from '@/lib/notifications';
import { EVERY_DAY, OWN_CHOICES, PRACTICE_CHOICES, TIMER_CHOICES } from '@/lib/tasks';
import type { TaskActivity, TaskItem, TasksData } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';

type Params = { id?: string; activity?: string; title?: string; hour?: string; minute?: string; minutes?: string };

const ACTIVITIES: TaskActivity[] = [...PRACTICE_CHOICES.map((p) => p.activity), 'own'];
const asActivity = (v?: string): TaskActivity => (ACTIVITIES.includes(v as TaskActivity) ? (v as TaskActivity) : 'breathe_calm');
const asNumber = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Adds or edits a daily task: what it is, when, which days, a timer for your own, and whether to remind. */
export default function EditTask() {
  const c = useTheme();
  const params = useLocalSearchParams<Params>();
  const editing = typeof params.id === 'string' && params.id.length > 0;

  const [loaded, setLoaded] = useState(!editing);
  const [activity, setActivity] = useState<TaskActivity>(asActivity(params.activity));
  const [ownTitle, setOwnTitle] = useState(params.activity === 'own' ? (params.title ?? '') : '');
  const [custom, setCustom] = useState(params.activity === 'own' && !OWN_CHOICES.some((o) => o.title === params.title));
  const [time, setTime] = useState({ hour: asNumber(params.hour, 0, 23, 15), minute: asNumber(params.minute, 0, 59, 0) });
  const [days, setDays] = useState(EVERY_DAY);
  const [minutes, setMinutes] = useState<number | null>(params.minutes ? asNumber(params.minutes, 1, 180, 10) : null);
  const [remind, setRemind] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    api<TasksData>('/tasks')
      .then(({ tasks }) => {
        const t = tasks.find((x: TaskItem) => x.id === params.id);
        if (!t) return setError('That task isn’t here any more.');
        setActivity(t.activity);
        if (t.activity === 'own') {
          setOwnTitle(t.title);
          setCustom(!OWN_CHOICES.some((o) => o.title === t.title));
        }
        setTime({ hour: t.hour, minute: t.minute });
        setDays(t.days);
        setMinutes(t.minutes);
        setRemind(t.remind);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoaded(true));
  }, [editing, params.id]);

  const own = activity === 'own';
  const title = own ? ownTitle.trim() : PRACTICE_CHOICES.find((p) => p.activity === activity)!.title;
  const canSave = loaded && !!title && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const body = { activity, title, ...time, days, minutes: own ? minutes : null, remind };
      if (editing) await api(`/tasks/${params.id}`, { method: 'PATCH', body });
      else await api('/tasks', { body });
      // Ask for notifications at the moment they're wanted.
      if (remind) await requestNotificationPermission();
      void syncReminders().catch(() => undefined);
      haptic.success();
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Delete this task?', `${title} won’t be planned or reminded any more.`))) return;
    try {
      await api(`/tasks/${params.id}`, { method: 'DELETE' });
      void syncReminders().catch(() => undefined);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!loaded) {
    return (
      <Screen>
        <Header title="Edit task" />
        <ActivityIndicator color={c.primary} style={{ marginTop: space.xxxl }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={editing ? 'Edit task' : 'New daily task'} />

      <SectionTitle title="What" />
      <T variant="small" color={c.inkSoft} style={{ marginBottom: space.sm }}>
        From Solace
      </T>
      <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
        {PRACTICE_CHOICES.map((p) => (
          <ChoiceChip key={p.activity} label={p.title} icon={p.icon} selected={activity === p.activity} onPress={() => setActivity(p.activity)} />
        ))}
      </Row>
      <T variant="small" color={c.inkSoft} style={{ marginTop: space.lg, marginBottom: space.sm }}>
        Your own
      </T>
      <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
        {OWN_CHOICES.map((o) => (
          <ChoiceChip
            key={o.title}
            label={o.title}
            icon={o.icon}
            selected={own && !custom && ownTitle === o.title}
            onPress={() => {
              setActivity('own');
              setCustom(false);
              setOwnTitle(o.title);
              setMinutes(o.minutes);
            }}
          />
        ))}
        <ChoiceChip
          label="Something else"
          icon="sprout"
          selected={own && custom}
          onPress={() => {
            setActivity('own');
            if (!custom) setOwnTitle('');
            setCustom(true);
          }}
        />
      </Row>
      {own && custom && (
        <Animated.View entering={FadeIn}>
          <TextInput
            value={ownTitle}
            onChangeText={setOwnTitle}
            placeholder="e.g. Evening walk"
            placeholderTextColor={c.inkFaint}
            style={[inputStyle(c), { marginTop: space.md }]}
            maxLength={60}
            autoFocus={!editing}
            accessibilityLabel="Task name"
          />
        </Animated.View>
      )}

      <SectionTitle title="When" />
      <Card>
        <TimePicker hour={time.hour} minute={time.minute} onChange={(hour, minute) => setTime({ hour, minute })} />
      </Card>

      <SectionTitle title="Which days" />
      <Card>
        <DayPicker days={days} onChange={setDays} />
      </Card>

      {own && (
        <>
          <SectionTitle title="Timer" />
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {TIMER_CHOICES.map((m) => {
              const on = minutes === m;
              return (
                <Tappable
                  key={m ?? 'none'}
                  onPress={() => setMinutes(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    borderWidth: 1.5,
                    borderColor: on ? c.primary : c.line,
                    backgroundColor: on ? c.primarySoft : c.surface,
                  }}
                >
                  <T variant="small" color={on ? c.primary : c.ink} style={on ? { fontFamily: fonts.bold } : undefined}>
                    {m ? `${m} min` : 'No timer'}
                  </T>
                </Tappable>
              );
            })}
          </Row>
        </>
      )}

      <Card style={{ marginTop: space.xl }}>
        <Row gap={space.md}>
          <T variant="bodyStrong" style={{ flex: 1 }}>
            Remind me at {formatTime(time.hour, time.minute)}
          </T>
          <Switch
            value={remind}
            onValueChange={setRemind}
            trackColor={{ true: c.primary, false: c.line }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Remind me"
          />
        </Row>
      </Card>

      {error && (
        <View style={{ marginTop: space.md }}>
          <ErrorNote message={error} />
        </View>
      )}

      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Button title={editing ? 'Save' : 'Add task'} icon="check" onPress={save} loading={saving} disabled={!canSave} />
        {editing && <Button title="Delete task" kind="ghost" onPress={remove} />}
      </View>
    </Screen>
  );
}
