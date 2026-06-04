/**
 * Types for AppExpandableSearch component
 */

import type { ColorName } from '@/themes';

export type AppExpandableSearchProps = {
  placeholder?: string;
  onSearchChange?: (query: string) => void;
  onExpandChange?: (isExpanded: boolean) => void;
  isExpanded?: boolean;
  searchQuery?: string;
  expandedWidth?: number;
  inputColorName?: ColorName;
  actionColorName?: ColorName;
  inputIconColorName?: ColorName;
  actionIconColorName?: ColorName;
  textColorName?: ColorName;
  placeholderColorName?: ColorName;
  shadowColorName?: ColorName;
};
