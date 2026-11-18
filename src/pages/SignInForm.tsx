import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowRight,
  IconCircleCheck,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { login } from '../api/auth';
import type { Session } from '../api/session';
import classes from './LoginPage.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignInFormProps {
  initialEmail?: string;
  /** Success message shown above the form, e.g. after registering. */
  notice?: string | null;
  onLogin: (session: Session, remember: boolean) => void;
  onSwitchToRegister: () => void;
}

export default function SignInForm({
  initialEmail = '',
  notice,
  onLogin,
  onSwitchToRegister,
}: SignInFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const nextErrors: typeof errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Enter a valid email address';
    if (!password) nextErrors.password = 'Enter your password';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const session = await login(email.trim(), password);
      onLogin(session, remember);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <Title order={1} className={classes.title}>
        Welcome back
      </Title>
      <Text className={classes.subtitle}>Sign in to the admin dashboard to continue.</Text>

      <form onSubmit={handleSubmit} noValidate>
        <Stack gap={20} mt={34}>
          {notice && !formError && (
            <Alert color="green" variant="light" radius="md" icon={<IconCircleCheck size={20} />}>
              {notice}
            </Alert>
          )}
          {formError && (
            <Alert
              color="red"
              variant="light"
              radius="md"
              icon={<IconAlertCircle size={20} />}
              title="Couldn't sign you in"
            >
              {formError}
            </Alert>
          )}

          <TextInput
            type="email"
            autoComplete="email"
            placeholder="Email address"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            error={errors.email}
            classNames={{ input: classes.input }}
            autoFocus={!initialEmail}
          />

          <PasswordInput
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            error={errors.password}
            classNames={{ input: classes.input, innerInput: classes.innerInput }}
            rightSectionWidth={56}
            visibilityToggleIcon={({ reveal }) =>
              reveal ? <IconEyeOff size={20} /> : <IconEye size={20} />
            }
            autoFocus={!!initialEmail}
          />

          <Group justify="space-between">
            <Checkbox
              label="Keep me signed in"
              checked={remember}
              onChange={(e) => setRemember(e.currentTarget.checked)}
              classNames={{ label: classes.checkboxLabel }}
              radius="sm"
            />
            <Anchor href="#" className={classes.link} underline="hover">
              Forgot password?
            </Anchor>
          </Group>

          <Button
            type="submit"
            fullWidth
            loading={loading}
            className={classes.submit}
            rightSection={<IconArrowRight size={18} stroke={2.2} />}
          >
            Sign in
          </Button>
        </Stack>
      </form>

      <Text className={classes.switchText}>
        Don&apos;t have an account?{' '}
        <Anchor component="button" type="button" className={classes.link} onClick={onSwitchToRegister}>
          Create one
        </Anchor>
      </Text>
    </>
  );
}
