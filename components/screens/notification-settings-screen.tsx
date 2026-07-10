import { useState } from 'react';
import { Switch } from 'react-native';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

// ─── Handoff #23 toggle dimensions ───────────────────────────────────────────
const TRACK_W = 46;
const TRACK_H = 27;
const KNOB = 21;

function BrandSwitch({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { tokens } = useThemeContext();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ false: tokens.switchTrackOff, true: tokens.switchTrackOn }}
      thumbColor={value ? tokens.switchThumbOn : tokens.white}
      ios_backgroundColor={tokens.switchTrackOff}
      style={{ transform: [{ scaleX: TRACK_W / 51 }, { scaleY: TRACK_H / 31 }] }}
    />
  );
}

type ToggleRowProps = {
  label: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  isLast?: boolean;
  disabled?: boolean;
};

function ToggleRow({ label, value, onChange, isLast, disabled }: ToggleRowProps) {
  const { tokens } = useThemeContext();
  return (
    <AppView
      row
      align="center"
      justify="space-between"
      py="md"
      px="lg"
      style={
        !isLast
          ? { borderBottomWidth: 1, borderBottomColor: tokens.divider }
          : undefined
      }
    >
      <AppText
        textVariant="bodySm"
        weight="semibold"
        colorName="text"
        style={disabled ? { opacity: 0.4 } : undefined}
      >
        {label}
      </AppText>
      <BrandSwitch value={value} onChange={onChange} disabled={disabled} />
    </AppView>
  );
}

type SectionProps = {
  title: string;
  rows: { label: string; value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }[];
};

function ToggleSection({ title, rows }: SectionProps) {
  const { tokens, scheme } = useThemeContext();
  return (
    <AppView px="lg" gap={10}>
      <AppText textVariant="subtitle" family="accent" weight="semibold" colorName="text">
        {title}
      </AppText>
      <AppView
        rounded={16}
        style={{
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
          overflow: 'hidden',
        }}
      >
        {rows.map((row, index) => (
          <ToggleRow
            key={row.label}
            label={row.label}
            value={row.value}
            onChange={row.onChange}
            disabled={row.disabled}
            isLast={index === rows.length - 1}
          />
        ))}
      </AppView>
    </AppView>
  );
}

export default function NotificationSettingsScreen() {
  // Push
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [priceDrops, setPriceDrops] = useState(true);
  const [backInStock, setBackInStock] = useState(false);
  const [newArrivals, setNewArrivals] = useState(false);

  // Email
  const [orderReceipts, setOrderReceipts] = useState(true);
  const [weeklyDeals, setWeeklyDeals] = useState(true);
  const [productTips, setProductTips] = useState(false);

  // SMS
  const [deliveryAlerts, setDeliveryAlerts] = useState(true);
  const [smsPromos, setSmsPromos] = useState(false);

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Notifications" fallbackHref="/profile" />
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, gap: 24 }}
      >
        <ToggleSection
          title="Push"
          rows={[
            { label: 'Order updates', value: orderUpdates, onChange: setOrderUpdates },
            { label: 'Price drops on saved parts', value: priceDrops, onChange: setPriceDrops },
            { label: 'Back in stock', value: backInStock, onChange: setBackInStock },
            { label: 'New arrivals', value: newArrivals, onChange: setNewArrivals },
          ]}
        />

        <ToggleSection
          title="Email"
          rows={[
            { label: 'Order receipts', value: orderReceipts, onChange: setOrderReceipts },
            { label: 'Weekly deals', value: weeklyDeals, onChange: setWeeklyDeals },
            { label: 'Product tips', value: productTips, onChange: setProductTips },
          ]}
        />

        <ToggleSection
          title="SMS"
          rows={[
            { label: 'Delivery alerts', value: deliveryAlerts, onChange: setDeliveryAlerts },
            { label: 'Promotions', value: smsPromos, onChange: setSmsPromos },
          ]}
        />
      </AppScrollView>
    </AppView>
  );
}
