import { router } from 'expo-router';
import { PackageOpen, SlidersHorizontal, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import SearchPartCard from '@/components/screens-components/search/search-part-card';
import { AppChip } from '@/components/shared/app-chip';
import { AppCountBadge } from '@/components/shared/app-count-badge';
import AppList from '@/components/shared/app-list';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import {
  DEFAULT_TOP_FEATURED_FILTERS,
  TOP_FEATURED_FILTER_GROUPS,
  getSelectedTopFeaturedFilterEntries,
  getTopFeaturedMockResponse,
  type TopFeaturedFilterTitle,
  type TopFeaturedFilters,
} from '@/services/top-featured-service';
import { triggerHaptic } from '@/utils/haptics';

export default function TopFeaturedScreen() {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<TopFeaturedFilters>(
    DEFAULT_TOP_FEATURED_FILTERS,
  );
  const featuredResponse = getTopFeaturedMockResponse(selectedFilters);
  const featuredItems = featuredResponse.items;
  const selectedFilterCount = Object.values(selectedFilters).filter(Boolean).length;
  const selectedFilterEntries = getSelectedTopFeaturedFilterEntries(selectedFilters);

  const handleFilterSelect = (groupTitle: TopFeaturedFilterTitle, option: string) => {
    triggerHaptic('selection');
    setSelectedFilters((current) => ({
      ...current,
      [groupTitle]: current[groupTitle] === option ? '' : option,
    }));
  };

  const handleClearFilters = () => {
    triggerHaptic('selection');
    setSelectedFilters({ ...DEFAULT_TOP_FEATURED_FILTERS });
  };

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title="Top Featured"
        fallbackHref="/explore"
        right={
          <AppView style={{ position: 'relative' }}>
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                setIsFilterExpanded((cur) => !cur);
              }}
              accessibilityRole="button"
              accessibilityLabel="Filter featured items"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: isFilterExpanded
                  ? tokens.backgroundSecondary
                  : isDark
                    ? tokens.card
                    : tokens.white,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <SlidersHorizontal size={16} strokeWidth={2.1} color={tokens.text} />
            </Pressable>
            <AppCountBadge count={selectedFilterCount} />
          </AppView>
        }
      />
      <AppList
        data={featuredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AppView px="sm" pb="md">
            <SearchPartCard
              id={item.id}
              badge={item.badge}
              status={item.status}
              title={item.title}
              description={item.description}
              price={item.price}
              actionLabel="Add"
              compact
              onPress={() =>
                router.push({ pathname: '/item-detail/[id]', params: { id: item.id } })
              }
            />
          </AppView>
        )}
        ListHeaderComponent={
          <AppView gap="lg" pb="md">
            <AppView px="lg" gap="xs">
            <AppText textVariant="bodySm" colorName="gray400">
              {featuredItems.length === 0
                ? 'No matches for this filter combination.'
                : `${featuredItems.length} parts featured this week`}
            </AppText>
            {selectedFilterCount > 0 ? (
              <AppText
                textVariant="bodyXs"
                weight="semibold"
                accessibilityRole="button"
                onPress={handleClearFilters}
                style={{ color: tokens.brand, alignSelf: 'flex-start' }}
              >
                Clear {selectedFilterCount} filter{selectedFilterCount === 1 ? '' : 's'}
              </AppText>
            ) : null}
          </AppView>

          {isFilterExpanded ? (
            <AppView px={16}>
              <AppView
                rounded={20}
                px={14}
                py={14}
                gap={14}
                style={{
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: isDark ? tokens.card : tokens.white,
                }}
              >
                <AppView row align="center" justify="space-between">
                  <AppText textVariant="bodySemibold" weight="semibold">
                    Filter featured
                  </AppText>
                  <AppView row gap={6} align="center">
                    {selectedFilterCount > 0 ? (
                      <Pressable
                        onPress={handleClearFilters}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel="Clear filters"
                        style={({ pressed }) => ({
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: tokens.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Trash2 size={13} strokeWidth={2.1} color={tokens.gray400} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        triggerHaptic('selection');
                        setIsFilterExpanded(false);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel="Close filters"
                      style={({ pressed }) => ({
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: tokens.border,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <X size={13} strokeWidth={2.2} color={tokens.gray400} />
                    </Pressable>
                  </AppView>
                </AppView>

                {selectedFilterEntries.length > 0 ? (
                  <AppView row gap={8} style={{ flexWrap: 'wrap' }}>
                    {selectedFilterEntries.map(([groupTitle, value]) => (
                      <AppChip
                        key={groupTitle}
                        label={`${groupTitle}: ${value}`}
                        size="sm"
                        kind="primary"
                        variant="solid"
                        selected
                        haptics="selection"
                        onPress={() => handleFilterSelect(groupTitle, value)}
                      />
                    ))}
                  </AppView>
                ) : null}

                {TOP_FEATURED_FILTER_GROUPS.map((group) => (
                  <AppView key={group.title} gap={8}>
                    <AppText
                      textVariant="bodyXs"
                      weight="semibold"
                      colorName="gray400"
                      transform="uppercase"
                    >
                      {group.title}
                    </AppText>
                    <AppView row gap={8} style={{ flexWrap: 'wrap' }}>
                      {group.options.map((option) => {
                        const isSelected = selectedFilters[group.title] === option;
                        return (
                          <AppChip
                            key={option}
                            label={option}
                            size="sm"
                            kind={isSelected ? 'primary' : 'neutral'}
                            variant={isSelected ? 'solid' : 'outline'}
                            selected={isSelected}
                            borderColorName="border"
                            haptics="selection"
                            onPress={() => handleFilterSelect(group.title, option)}
                          />
                        );
                      })}
                    </AppView>
                  </AppView>
                ))}
              </AppView>
            </AppView>
          ) : null}

          </AppView>
        }
        ListEmptyComponent={
          <AppView px="lg">
            <AppView
              rounded={20}
              center
              py={48}
              px="xl"
              gap="sm"
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: isDark ? tokens.card : tokens.white,
              }}
            >
              <PackageOpen size={28} strokeWidth={2} color={tokens.gray400} />
              <AppText textVariant="bodySemibold">No matches</AppText>
              <AppText
                textVariant="bodySm"
                colorName="gray400"
                style={{ textAlign: 'center', maxWidth: 240 }}
              >
                Try removing a filter to widen the selection.
              </AppText>
            </AppView>
          </AppView>
        }
      />
    </AppView>
  );
}
