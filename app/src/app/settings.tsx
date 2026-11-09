import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { HandIcon } from '@/components/HandIcon';
import { Sol, type SolMood } from '@/components/Sol';
import { Button, Card, Chip, ErrorNote, Header, inputStyle, Row, Screen, SectionTitle, T, Tappable, type IconName } from '@/components/ui';
import { FOCUS_AREAS } from '@/content/wellness';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import type { Tone } from '@/lib/types';
import { radius, space, useTheme, useThemeMode, type ThemeMode } from '@/theme';

const TONES: { id: Tone; label: string; mood: SolMood }[] = [
  { id: 'gentle', label: 'Gentle', mood: 'calm' },
  { id: 'cheerful', label: 'Cheerful', mood: 'joyful' },
  { id: 'direct', label: 'Direct', mood: 'thinking' },
];

const APPEARANCE: { id: ThemeMode; label: string; icon: IconName }[] = [
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'system', label: 'Match phone', icon: 'smartphone' },
];

export default function Settings() {
  const c = useTheme();
  const { mode, setMode } = useThemeMode();
  const { user, updateUser, deleteAccount } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [focus, setFocus] = useState<string[]>(user?.profile.focus ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async (patch: Parameters<typeof updateUser>[0]) => {
    setError(null);
    setSaved(false);
    try {
      await updateUser(patch);
      haptic.success();
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const tone = user?.preferences.tone ?? 'gentle';

  return (
    <Screen>
      <Header title="Settings" />
      {error && <ErrorNote message={error} />}

      <SectionTitle title="Your name" />
      <Row gap={space.sm}>
        <TextInput value={name} onChangeText={setName} style={[inputStyle(c), { flex: 1 }]} maxLength={60} placeholder="Your name" placeholderTextColor={c.inkFaint} />
        <Button title="Save" small onPress={() => name.trim() && save({ name: name.trim() })} disabled={!name.trim() || name.trim() === user?.name} />
      </Row>

      <SectionTitle title="Appearance" />
      <Row gap={space.sm}>
        {APPEARANCE.map((a) => {
          const active = mode === a.id;
          return (
            <Tappable
              key={a.id}
              onPress={() => {
                haptic.soft();
                setMode(a.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 6,
                paddingVertical: space.md,
                borderRadius: radius.md,
                backgroundColor: active ? c.primarySoft : c.surface,
                borderWidth: 1.5,
                borderColor: active ? c.primary : c.line,
              }}
            >
              <HandIcon name={a.icon} size={24} color={active ? c.primary : c.inkSoft} />
              <T variant="small" color={active ? c.ink : c.inkSoft}>
                {a.label}
              </T>
            </Tappable>
          );
        })}
      </Row>

      <SectionTitle title="How Sol talks to you" />
      <Row gap={space.sm}>
        {TONES.map((t) => {
          const active = tone === t.id;
          return (
            <Tappable
              key={t.id}
              onPress={() => save({ preferences: { tone: t.id } })}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 6,
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: active ? c.primarySoft : c.surface,
                borderWidth: 1.5,
                borderColor: active ? c.primary : c.line,
              }}
            >
              <Sol size={48} mood={t.mood} animated={false} moodFace />
              <T variant="bodyStrong">{t.label}</T>
            </Tappable>
          );
        })}
      </Row>

      <SectionTitle title="What you’d like support with" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {FOCUS_AREAS.map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            icon={f.icon}
            selected={focus.includes(f.id)}
            onPress={() => setFocus((list) => (list.includes(f.id) ? list.filter((x) => x !== f.id) : [...list, f.id]))}
          />
        ))}
      </View>
      <Button title="Save focus areas" kind="secondary" small onPress={() => save({ profile: { focus } })} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
      {saved && (
        <T variant="small" color={c.success} style={{ marginTop: space.sm }}>
          Saved
        </T>
      )}

      <SectionTitle title="Account" />
      <Card style={{ gap: space.md }}>
        <T variant="small" color={c.inkSoft}>
          Signed in as {user?.email}. Time zone: {user?.timezone}.
        </T>
        <Button
          title="Delete my account"
          kind="danger"
          icon="trash-2"
          loading={deleting}
          onPress={async () => {
            const ok = await confirm(
              'Delete your account?',
              'This permanently deletes your account, check-ins, journal, conversations and everything Sol remembers. This can’t be undone.',
              'Delete everything',
            );
            if (!ok) return;
            setDeleting(true);
            try {
              await deleteAccount();
            } catch (e) {
              setError(errorMessage(e));
              setDeleting(false);
            }
          }}
        />
      </Card>
    </Screen>
  );
}
