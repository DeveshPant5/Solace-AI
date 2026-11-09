import { Link } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { SocialSignIn } from '@/components/SocialSignIn';
import { Sol } from '@/components/Sol';
import { Button, ErrorNote, Header, inputStyle, Row, Screen, T } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { space, useTheme } from '@/theme';

export default function SignIn() {
  const c = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      haptic.success();
    } catch (e) {
      setError(errorMessage(e));
      haptic.warning();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header />
      <View style={{ alignItems: 'center', gap: space.md, marginBottom: space.xxl }}>
        <Sol size={110} mood="joyful" />
        <T variant="title" center>
          Welcome back
        </T>
        <T variant="body" color={c.inkSoft} center>
          Luma missed you.
        </T>
      </View>
      <View style={{ gap: space.md }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={c.inkFaint}
          style={inputStyle(c)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={c.inkFaint}
          style={inputStyle(c)}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {error && <ErrorNote message={error} />}
        <Button title="Sign in" onPress={submit} loading={busy} style={{ marginTop: space.sm }} />
      </View>
      <SocialSignIn disabled={busy} />
      <Row style={{ justifyContent: 'center', marginTop: space.xl }} gap={6}>
        <T variant="small" color={c.inkSoft}>
          New here?
        </T>
        <Link href="/welcome" replace>
          <T variant="small" color={c.primary}>
            Create an account
          </T>
        </Link>
      </Row>
    </Screen>
  );
}
