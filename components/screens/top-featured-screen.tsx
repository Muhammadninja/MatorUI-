import { router } from 'expo-router';
import { ArrowLeft, SlidersHorizontal, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';

import ScreenShell from '@/components/screens-components/screen-shell';
import SearchPartCard from '@/components/screens-components/search-part-card';
import { AppChip } from '@/components/shared/app-chip';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
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
  const { scheme, tokens } = useThemeContext();
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
    setSelectedFilters(
      Object.keys(DEFAULT_TOP_FEATURED_FILTERS).reduce<TopFeaturedFilters>(
        (accumulator, key) => {
          accumulator[key as TopFeaturedFilterTitle] = '';
          return accumulator;
        },
        { ...DEFAULT_TOP_FEATURED_FILTERS },
      ),
    );
  };

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <AppView mt={14} gap={16}>
          <AppView px={16} gap={10}>
            <AppView row align="center" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
                <AppPressableView
                  row
                  align="center"
                  androidRipple={false}
                  onPress={() => router.back()}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
                </AppPressableView>
              </AppView>

              <AppText
                textVariant="title"
                family="heading"
                weight="bold"
                style={{ textAlign: 'center' }}
              >
                Top Featured
              </AppText>

              <AppView row gap={8} style={{ flex: 1, justifyContent: 'flex-end' }}>
                <AppView style={{ position: 'relative' }}>
                  <AppPressableView
                    row
                    align="center"
                    rounded={36}
                    px={10}
                    py={8}
                    androidRipple={false}
                    onPress={() => {
                      triggerHaptic('selection');
                      setIsFilterExpanded((current) => !current);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: tokens.border,
                      backgroundColor: isFilterExpanded
                        ? scheme === 'dark'
                          ? tokens.gray200
                          : tokens.gray100
                        : tokens.background,
                    }}
                  >
                    <SlidersHorizontal
                      size={16}
                      strokeWidth={2.1}
                      color={scheme === 'dark' ? tokens.white : tokens.gray400}
                    />
                  </AppPressableView>
                  {selectedFilterCount ? (
                    <AppView
                      center
                      rounded={36}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        backgroundColor: scheme === 'dark' ? tokens.white : tokens.black,
                      }}
                    >
                      <AppText
                        textVariant="bodyXs"
                        weight="bold"
                        style={{ color: scheme === 'dark' ? tokens.black : tokens.white }}
                      >
                        {selectedFilterCount}
                      </AppText>
                    </AppView>
                  ) : null}
                </AppView>
              </AppView>
            </AppView>

            {isFilterExpanded ? (
              <AppView
                rounded={20}
                px={12}
                py={12}
                gap={10}
                style={{
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: tokens.background,
                }}
              >
                <AppView gap={8}>
                  <AppView row align="center" justify="space-between">
                    <AppView gap={2} style={{ flex: 1, paddingRight: 12 }}>
                      <AppText textVariant="bodySm" colorName="gray400">
                        Selected filters
                      </AppText>
                      <AppText textVariant="bodyXs" colorName="gray400">
                        Active picks appear here. Ready for API and socket sync.
                      </AppText>
                    </AppView>
                    <AppView row gap={8} align="center">
                      {selectedFilterCount ? (
                        <AppPressableView
                          row
                          align="center"
                          rounded={32}
                          px={8}
                          py={8}
                          androidRipple={false}
                          onPress={handleClearFilters}
                          style={{
                            borderWidth: 1,
                            borderColor: tokens.border,
                            backgroundColor: tokens.background,
                          }}
                        >
                          <Trash2
                            size={14}
                            strokeWidth={2.1}
                            color={scheme === 'dark' ? tokens.white : tokens.gray400}
                          />
                        </AppPressableView>
                      ) : null}
                      <AppPressableView
                        row
                        align="center"
                        rounded={32}
                        px={8}
                        py={8}
                        androidRipple={false}
                        onPress={() => {
                          triggerHaptic('selection');
                          setIsFilterExpanded(false);
                        }}
                        style={{
                          borderWidth: 1,
                          borderColor: tokens.border,
                          backgroundColor: tokens.background,
                        }}
                      >
                        <X size={14} strokeWidth={2.2} color={tokens.gray400} />
                      </AppPressableView>
                    </AppView>
                  </AppView>
                  {selectedFilterEntries.length ? (
                    <AppView row gap={8} style={{ flexWrap: 'wrap' }}>
                      {selectedFilterEntries.map(([groupTitle, value]) => (
                        <AppChip
                          key={groupTitle}
                          label={`${groupTitle}: ${value}`}
                          size="sm"
                          kind="secondary"
                          variant="solid"
                          selected
                          labelColorName={scheme === 'dark' ? 'white' : 'black'}
                          haptics="selection"
                          onPress={() => handleFilterSelect(groupTitle, value)}
                        />
                      ))}
                    </AppView>
                  ) : (
                    <AppText textVariant="bodyXs" colorName="gray400">
                      No filters selected.
                    </AppText>
                  )}
                </AppView>
                {TOP_FEATURED_FILTER_GROUPS.map((group) => (
                  <AppView key={group.title} gap={8}>
                    <AppText textVariant="bodyXs" weight="semibold" colorName="gray400">
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
                            kind={isSelected ? 'secondary' : 'neutral'}
                            variant={isSelected ? 'solid' : 'outline'}
                            selected={isSelected}
                            labelColorName={
                              isSelected ? (scheme === 'dark' ? 'white' : 'black') : 'text'
                            }
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
            ) : null}

            <AppText textVariant="bodySm" colorName="gray400">
              Browse every highlighted part and featured upgrade in one place.
            </AppText>
          </AppView>

          <AppView px={16}>
            <AppView row gap={12} justify="space-between" style={{ flexWrap: 'wrap' }}>
              {featuredItems.map((item) => (
                <SearchPartCard
                  key={item.id}
                  id={item.id}
                  badge={item.badge}
                  status={item.status}
                  title={item.title}
                  description={item.description}
                  price={item.price}
                  actionLabel="Add"
                  compact
                  style={{ width: '48%' }}
                />
              ))}
            </AppView>
          </AppView>
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
