import { Box, Group, Stack, Text } from '@mantine/core';
import { IconMessages, IconPaw, IconShieldCheck, IconShoppingBag } from '@tabler/icons-react';
import logoUrl from '../assets/petwork-logo.png';
import { useState } from 'react';
import type { Session } from '../api/session';
import classes from './LoginPage.module.css';
import RegisterForm from './RegisterForm';
import SignInForm from './SignInForm';

const features = [
  {
    icon: IconShieldCheck,
    title: 'Manage stores & sellers',
    description: 'Review seller applications, approve stores and control access.',
  },
  {
    icon: IconShoppingBag,
    title: 'Oversee catalog & orders',
    description: 'Products, categories, pricing, orders and fulfilment in one place.',
  },
  {
    icon: IconMessages,
    title: 'Moderate the community',
    description: 'Keep posts, groups and events safe and friendly for pet owners.',
  },
];

const CURRENT_YEAR = new Date().getFullYear();
interface LoginPageProps {
  onLogin: (session: Session, remember: boolean) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [prefillEmail, setPrefillEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className={classes.root}>
      {/* Brand panel */}
      <aside className={classes.brand}>
        <div className={classes.grid} aria-hidden />
        <IconPaw className={classes.pawDecor} aria-hidden stroke={1} />

        <Group gap="sm" className={classes.logo}>
          <div className={classes.logoMark}>
            <img src={logoUrl} alt="PetWork" className={classes.logoImg} />
          </div>
          <div>
            <Text className={classes.logoName}>PetWork</Text>
            <Text className={classes.logoTag}>Admin portal</Text>
          </div>
        </Group>

        <div className={classes.hero}>
          <div className={classes.badge}>
            <span className={classes.badgeDot} />
            Admin access
          </div>

          <h1 className={classes.headline}>
            Run the pet community
            <br />
            <span className={classes.headlineAccent}>with confidence.</span>
          </h1>

          <Text className={classes.lead}>
            Sign in to manage stores, products, orders and the pet-owner community across
            PetWork.
          </Text>

          <Stack gap={26} mt={40}>
            {features.map(({ icon: Icon, title, description }) => (
              <Group key={title} gap="md" wrap="nowrap" align="flex-start">
                <div className={classes.featureIcon}>
                  <Icon size={20} stroke={1.7} />
                </div>
                <div>
                  <Text className={classes.featureTitle}>{title}</Text>
                  <Text className={classes.featureText}>{description}</Text>
                </div>
              </Group>
            ))}
          </Stack>
        </div>

        <Group gap="xl" className={classes.footer}>
          <Text inherit>© {CURRENT_YEAR} PetWork</Text>
          <a href="#" className={classes.footerLink}>
            Help Center
          </a>
          <a href="#" className={classes.footerLink}>
            Contact
          </a>
        </Group>
      </aside>

      {/* Sign-in / register form */}
      <main className={classes.formSide}>
        <Box className={classes.formWrap}>
          <Group gap="sm" className={classes.mobileLogo}>
            <div className={classes.logoMarkSolid}>
              <img src={logoUrl} alt="PetWork" className={classes.logoImg} />
            </div>
            <Text fw={800} fz="lg">
              PetWork Admin
            </Text>
          </Group>

          {mode === 'signin' ? (
            <SignInForm
              key={prefillEmail}
              initialEmail={prefillEmail}
              notice={notice}
              onLogin={onLogin}
              onSwitchToRegister={() => {
                setNotice(null);
                setMode('register');
              }}
            />
          ) : (
            <RegisterForm
              onRegistered={(email, message) => {
                setPrefillEmail(email);
                setNotice(`${message} You can now sign in.`);
                setMode('signin');
              }}
              onSwitchToSignIn={() => setMode('signin')}
            />
          )}
        </Box>
      </main>
    </div>
  );
}
