import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Grid,
  Group,
  Image,
  Paper,
  Skeleton,
  Spoiler,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBolt,
  IconPhotoOff,
  IconRosetteDiscountCheck,
  IconTag,
} from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { BlueprintAction } from '../../api/blueprint';
import { fetchVariantDetails } from '../../api/records';
import CartStepper from './CartStepper';
import titleClasses from './PageTitle.module.css';
import classes from './ProductViewPage.module.css';
import { toProductView, type ProductView } from './productView';
import ZoomImage from './ZoomImage';
import type { CartController } from './useCart';

interface ProductViewPageProps {
  /** The "view" row action; its `dataApi` takes `{variantId}`. */
  action: BlueprintAction;
  variantId: string;
  title: string;
  subtitle?: string;
  cart: CartController;
  onBack: () => void;
  /** Shown at the top right, e.g. the page's Cart button. */
  headerRight?: ReactNode;
}

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; view: ProductView };

const currency = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;

const WHY_US = [
  { icon: IconBolt, title: 'Superfast delivery', text: 'Orders reach the doorstep at the earliest.' },
  { icon: IconTag, title: 'Best prices & offers', text: 'Great prices and offers direct from the brands.' },
  { icon: IconRosetteDiscountCheck, title: 'Genuine products', text: 'Sourced from authorised brand partners.' },
];

/** Product page for one variant: gallery, unit picker, price with Add to Cart, and details. */
export default function ProductViewPage({ action, variantId, title, subtitle, cart, onBack, headerRight }: ProductViewPageProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchVariantDetails(action.dataApi ?? '', variantId)
      .then((record) => {
        if (cancelled) return;
        const view = toProductView(record, variantId);
        setSelected(view.initialIndex);
        setImageIndex(0);
        setLoad({ status: 'ready', view });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: err instanceof Error ? err.message : 'Could not load the product.' });
      });
    return () => {
      cancelled = true;
    };
  }, [action.dataApi, variantId, attempt]);

  const retry = () => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    // Fills the screen like the list page: the header (back, title, cart) stays put and only the product scrolls.
    <Stack gap="lg" style={{ height: 'calc(100dvh - 60px - 2 * var(--mantine-spacing-md))' }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" style={{ flexShrink: 0 }}>
        <Group gap="md" align="flex-start" wrap="nowrap">
          <ActionIcon variant="default" size={44} radius="md" aria-label="Back" onClick={onBack}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          {/* Same heading style as the list pages: gradient text and a growing accent bar. */}
          <div className={titleClasses.wrap}>
            <Title order={2} className={titleClasses.title}>
              {title}
            </Title>
            <span className={titleClasses.bar} aria-hidden />
            {subtitle && (
              <Text size="sm" c="dimmed">
                {subtitle}
              </Text>
            )}
          </div>
        </Group>
        {headerRight}
      </Group>

      {/* Small padding (offset by the negative margin) so the card's border and shadow aren't clipped. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: -6, padding: 6 }}>

      {load.status === 'loading' && (
        <Paper withBorder radius="lg" p="lg">
          <Grid gap="xl">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Skeleton style={{ aspectRatio: '1' }} radius="lg" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="md">
                <Skeleton h={28} w="70%" />
                <Skeleton h={14} w="30%" />
                <Skeleton h={70} w={140} radius="md" />
                <Skeleton h={50} />
                <Skeleton h={120} />
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>
      )}

      {load.status === 'error' && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't load this product">
          <Text size="sm" mb="sm">
            {load.message}
          </Text>
          <Button size="xs" variant="light" color="red" onClick={retry}>
            Try again
          </Button>
        </Alert>
      )}

      {load.status === 'ready' && (
        <ProductBody
          view={load.view}
          selected={selected}
          onSelect={(i) => {
            setSelected(i);
            setImageIndex(0);
          }}
          imageIndex={imageIndex}
          onImage={setImageIndex}
          cart={cart}
        />
      )}
      </div>
    </Stack>
  );
}

function ProductBody({ view, selected, onSelect, imageIndex, onImage, cart }: {
  view: ProductView;
  selected: number;
  onSelect: (index: number) => void;
  imageIndex: number;
  onImage: (index: number) => void;
  cart: CartController;
}) {
  const variant = view.variants[selected] ?? view.variants[0];
  const images = variant?.images ?? [];
  const image = images[imageIndex] ?? images[0];
  const quantity = variant?.id ? (cart.quantities[variant.id] ?? 0) : 0;
  const hasDiscount = variant?.discount !== undefined && variant.discount > 0;

  return (
    <Paper withBorder radius="lg" p={{ base: 'md', md: 'xl' }} className={classes.page}>
      <Grid gap="xl">
        {/* ---------- Gallery ---------- */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          {/* Thumbnails in a column on the left, the main picture filling the rest. */}
          <div className={`${classes.gallery} ${classes.sticky}`}>
            {images.length > 1 && (
              <div className={classes.thumbRail}>
                <div className={classes.thumbList}>
                  {images.map((src, i) => (
                    <UnstyledButton
                      key={src}
                      className={classes.thumb}
                      data-active={i === imageIndex || undefined}
                      aria-label={`Picture ${i + 1}`}
                      onClick={() => onImage(i)}
                    >
                      <Image src={src} alt="" w="100%" h="100%" fit="contain" loading="lazy" />
                    </UnstyledButton>
                  ))}
                </div>
              </div>
            )}

            <div className={classes.mainFrame}>
              {image ? (
                // Hover the picture: a lens follows the cursor and a magnified view opens beside it.
                <ZoomImage src={image} alt={view.name}>
                  {hasDiscount && (
                    <Box className={classes.ribbon}>
                      {Math.round(variant.discount!)}%<br />OFF
                    </Box>
                  )}
                </ZoomImage>
              ) : (
                <Box className={classes.stage}>
                  <Center h="100%">
                    <IconPhotoOff size={48} color="var(--mantine-color-gray-4)" />
                  </Center>
                </Box>
              )}
            </div>
          </div>
        </Grid.Col>

        {/* ---------- Details ---------- */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="lg">
            <div>
              <Title order={2} className={classes.name}>
                {view.name}
              </Title>
              {view.brand && (
                <Text size="sm" fw={600} c="indigo.6" mt={6}>
                  by {view.brand}
                </Text>
              )}
            </div>

            {view.variants.length > 0 && (
              <div>
                <Text fw={700} mb="sm">
                  Select unit
                </Text>
                <Group gap="sm">
                  {view.variants.map((v, i) => (
                    <UnstyledButton
                      key={v.id ?? i}
                      className={classes.unit}
                      data-active={i === selected || undefined}
                      onClick={() => onSelect(i)}
                    >
                      {v.discount !== undefined && v.discount > 0 && (
                        <span className={classes.unitBadge}>{Math.round(v.discount)}% OFF</span>
                      )}
                      <Text size="sm" fw={600}>
                        {v.size ?? `Option ${i + 1}`}
                      </Text>
                      {v.price !== undefined && (
                        <Group gap={6} justify="center" wrap="nowrap">
                          <Text size="sm" fw={700}>
                            {currency(v.price)}
                          </Text>
                          {v.mrp !== undefined && v.mrp > v.price && (
                            <Text size="xs" c="dimmed" td="line-through">
                              {currency(v.mrp)}
                            </Text>
                          )}
                        </Group>
                      )}
                    </UnstyledButton>
                  ))}
                </Group>
              </div>
            )}

            <Divider color="gray.2" />

            {/* Price and Add to Cart */}
            <Group justify="space-between" align="center" wrap="nowrap" gap="md">
              <div>
                {variant?.size && (
                  <Text size="xs" c="dimmed">
                    {variant.size}
                  </Text>
                )}
                {variant?.price !== undefined && (
                  <Group gap={8} align="baseline">
                    <Text fz={26} fw={800} lh={1.2}>
                      {currency(variant.price)}
                    </Text>
                    {variant.mrp !== undefined && variant.mrp > variant.price && (
                      <Text size="sm" c="dimmed">
                        MRP <span style={{ textDecoration: 'line-through' }}>{currency(variant.mrp)}</span>
                      </Text>
                    )}
                    {hasDiscount && (
                      <Text size="sm" fw={700} c="green.7">
                        {Math.round(variant.discount!)}% off
                      </Text>
                    )}
                  </Group>
                )}
                <Text size="xs" c="dimmed">
                  (Inclusive of all taxes)
                </Text>
              </div>
              {cart.addAction && (
                <Box>
                  <CartStepper
                    action={cart.addAction}
                    variantId={variant?.id}
                    quantity={quantity}
                    onQuantityChange={(q) => variant?.id && cart.setQuantity(variant.id, q)}
                    tone="solid"
                    size="lg"
                  />
                </Box>
              )}
            </Group>

            <Divider color="gray.2" />

            <div>
              <Text fw={700} mb="md">
                Why shop from us?
              </Text>
              <Stack gap="md">
                {WHY_US.map((w) => (
                  <Group key={w.title} gap="md" wrap="nowrap" className={classes.why}>
                    <ThemeIcon size={42} radius="xl" variant="light" color="indigo" className={classes.whyIcon}>
                      <w.icon size={20} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={600}>
                        {w.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {w.text}
                      </Text>
                    </div>
                  </Group>
                ))}
              </Stack>
            </div>

            {view.description && (
              <div>
                <Text fw={700} mb="xs">
                  Product details
                </Text>
                <Spoiler maxHeight={150} showLabel="Read more" hideLabel="Show less" transitionDuration={300}>
                  <Text size="sm" c="gray.7" lh={1.7} style={{ whiteSpace: 'pre-line' }}>
                    {view.description}
                  </Text>
                </Spoiler>
              </div>
            )}

            {view.highlights.length > 0 && (
              <div>
                <Text fw={700} mb="xs">
                  Product information
                </Text>
                <Box className={classes.specs}>
                  {view.highlights.map((h) => (
                    <div key={h.label} className={classes.specRow}>
                      <Text size="sm" c="dimmed">
                        {h.label}
                      </Text>
                      <Text size="sm" fw={500}>
                        {h.value}
                      </Text>
                    </div>
                  ))}
                </Box>
              </div>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
