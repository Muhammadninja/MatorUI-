import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';
import AppImage from '@/components/shared/app-image';
import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppButton } from '../shared/app-button';
import { AppCard } from '../shared/app-card';
import { AppText } from '../shared/app-text';
import { AppView } from '../shared/app-view';

export type SearchPartCardProps = {
  id: string;
  badge?: string;
  status?: string;
  title: string;
  description: string;
  priceLabel?: string;
  price: string;
  actionLabel?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export default function SearchPartCard({
  id,
  badge = 'Featured',
  status = 'Ready to ship',
  title,
  description,
  priceLabel = 'Starting at',
  price,
  actionLabel = 'Add to cart',
  compact = false,
  style,
  onPress,
}: SearchPartCardProps) {
  const { tokens } = useThemeContext();
  const { addItem } = useCartContext();
  const [wasJustAdded, setWasJustAdded] = useState(false);
  const resetAddedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardPadding = compact ? 10 : 12;
  const mediaPadding = compact ? 10 : 12;
  const bodyGap = compact ? 8 : 10;
  const titleVariant = compact ? 'bodySm' : 'h4';
  const priceVariant = compact ? 'bodySm' : 'h4';

  useEffect(() => {
    return () => {
      if (resetAddedTimeoutRef.current) {
        clearTimeout(resetAddedTimeoutRef.current);
      }
    };
  }, []);

  const handleAddToCart = () => {
    triggerHaptic('success');
    addItem({
      id,
      title,
      description,
      price,
      priceLabel,
      badge,
      status,
    });
    setWasJustAdded(true);

    if (resetAddedTimeoutRef.current) {
      clearTimeout(resetAddedTimeoutRef.current);
    }

    resetAddedTimeoutRef.current = setTimeout(() => {
      setWasJustAdded(false);
    }, 1400);
  };

  return (
    <AppCard
      variant="outline"
      padding={cardPadding}
      rounded={24}
      style={style}
      onPress={onPress}
      media={
        <AppView style={{ position: 'relative' }}>
          <AppImage
            source={require('@/assets/images/test-image.png')}
            width="100%"
            height={compact ? 140 : 180}
            contentFit="cover"
            priority="normal"
            alt={title}
          />
          {/* Badge + status overlay */}
          <AppView
            row
            align="center"
            justify="space-between"
            px={mediaPadding}
            py={compact ? 8 : 10}
            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          >
            <AppView px={10} py={6} rounded={36} style={{ backgroundColor: tokens.secondary }}>
              <AppText textVariant="bodyXs" weight="semibold" colorName="onSecondary">
                {badge}
              </AppText>
            </AppView>
            <AppView px={8} py={4} rounded={36} style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
              <AppText textVariant="bodyXs" style={{ color: '#fff' }}>
                {status}
              </AppText>
            </AppView>
          </AppView>
        </AppView>
      }
    >
      <AppView gap={bodyGap} px={compact ? 4 : 8}>
        <AppView gap={compact ? 3 : 4}>
          <AppText textVariant={titleVariant} family="heading" numberOfLines={compact ? 2 : 1}>
            {title}
          </AppText>
          <AppText textVariant="bodySm" colorName="gray400" numberOfLines={compact ? 3 : 2}>
            {description}
          </AppText>
        </AppView>

        {compact ? (
          <AppView gap={8}>
            <AppView gap={2}>
              <AppText textVariant="bodyXs" colorName="gray400">
                {priceLabel}
              </AppText>
              <AppText textVariant={priceVariant} family="heading">
                {price}
              </AppText>
            </AppView>
            <AppButton
              title={wasJustAdded ? 'Added' : actionLabel}
              kind="secondary"
              size="xs"
              fullWidth
              onPress={handleAddToCart}
            />
          </AppView>
        ) : (
          <AppView row align="center" justify="space-between" gap={12}>
            <AppView gap={2} style={{ flex: 1 }}>
              <AppText textVariant="bodyXs" colorName="gray400">
                {priceLabel}
              </AppText>
              <AppText textVariant={priceVariant} family="heading">
                {price}
              </AppText>
            </AppView>
            <AppButton
              title={wasJustAdded ? 'Added' : actionLabel}
              kind="secondary"
              size="sm"
              containerStyle={{ flexShrink: 0 }}
              onPress={handleAddToCart}
            />
          </AppView>
        )}
      </AppView>
    </AppCard>
  );
}
