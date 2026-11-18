import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconAlertCircle, IconArrowRight, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { registerCustomer } from '../api/auth';
import classes from './LoginPage.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s-]{7,20}$/;

type Field = 'name' | 'email' | 'phone' | 'password' | 'confirm';

interface RegisterFormProps {
  /** Called after the account is created, with the server message and the email used. */
  onRegistered: (email: string, message: string) => void;
  onSwitchToSignIn: () => void;
}

export default function RegisterForm({ onRegistered, onSwitchToSignIn }: RegisterFormProps) {
  const [values, setValues] = useState<Record<Field, string>>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (field: Field) => (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    setValues((v) => ({ ...v, [field]: value }));
  };

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    const name = values.name.trim();
    const phone = values.phone.trim();
    if (!name) next.name = 'Enter your full name';
    else if (name.length > 255) next.name = 'Name is too long';
    if (!EMAIL_PATTERN.test(values.email.trim())) next.email = 'Enter a valid email address';
    if (!PHONE_PATTERN.test(phone)) next.phone = 'Enter a valid phone number (7–20 digits)';
    if (values.password.length < 6) next.password = 'Password must be at least 6 characters';
    else if (values.password.length > 128) next.password = 'Password is too long';
    if (values.confirm !== values.password) next.confirm = 'Passwords do not match';
    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const next = validate();
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const email = values.email.trim();
      const message = await registerCustomer({
        name: values.name.trim(),
        email,
        phone: values.phone.trim(),
        password: values.password,
      });
      onRegistered(email, message);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const eye = ({ reveal }: { reveal: boolean }) =>
    reveal ? <IconEyeOff size={20} /> : <IconEye size={20} />;

  return (
    <>
      <Title order={1} className={classes.title}>
        Create your account
      </Title>
      <Text className={classes.subtitle}>Join PetWork as a pet owner in a few seconds.</Text>

      <form onSubmit={handleSubmit} noValidate>
        <Stack gap={16} mt={30}>
          {formError && (
            <Alert
              color="red"
              variant="light"
              radius="md"
              icon={<IconAlertCircle size={20} />}
              title="Couldn't create your account"
            >
              {formError}
            </Alert>
          )}

          <TextInput
            autoComplete="name"
            placeholder="Full name"
            aria-label="Full name"
            value={values.name}
            onChange={set('name')}
            error={errors.name}
            classNames={{ input: classes.inputCompact }}
            autoFocus
          />
          <TextInput
            type="email"
            autoComplete="email"
            placeholder="Email address"
            aria-label="Email address"
            value={values.email}
            onChange={set('email')}
            error={errors.email}
            classNames={{ input: classes.inputCompact }}
          />
          <TextInput
            type="tel"
            autoComplete="tel"
            placeholder="Phone number"
            aria-label="Phone number"
            value={values.phone}
            onChange={set('phone')}
            error={errors.phone}
            classNames={{ input: classes.inputCompact }}
          />
          <PasswordInput
            autoComplete="new-password"
            placeholder="Password (min. 6 characters)"
            aria-label="Password"
            value={values.password}
            onChange={set('password')}
            error={errors.password}
            classNames={{ input: classes.inputCompact, innerInput: classes.innerInput }}
            rightSectionWidth={56}
            visibilityToggleIcon={eye}
          />
          <PasswordInput
            autoComplete="new-password"
            placeholder="Confirm password"
            aria-label="Confirm password"
            value={values.confirm}
            onChange={set('confirm')}
            error={errors.confirm}
            classNames={{ input: classes.inputCompact, innerInput: classes.innerInput }}
            rightSectionWidth={56}
            visibilityToggleIcon={eye}
          />

          <Button
            type="submit"
            fullWidth
            loading={loading}
            className={classes.submit}
            rightSection={<IconArrowRight size={18} stroke={2.2} />}
          >
            Create account
          </Button>
        </Stack>
      </form>

      <Text className={classes.switchText}>
        Already have an account?{' '}
        <Anchor component="button" type="button" className={classes.link} onClick={onSwitchToSignIn}>
          Sign in
        </Anchor>
      </Text>
    </>
  );
}
