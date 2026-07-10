import {
  Cog,
  Disc3,
  Droplets,
  Settings2,
  Snowflake,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

import type { Category } from '@/types/catalog-nav';

/** A Master System with its icon (kept next to the data — static config). */
export type CatalogSystem = Category & { Icon: LucideIcon };

/**
 * The 8 core vehicle systems shown on the catalog landing (Stage 2). Bilingual
 * (EN + RU). `categoryKey` is what the parts query filters by once the backend
 * exposes a category param.
 */
export const CATALOG_SYSTEMS: CatalogSystem[] = [
  { id: 'brakes', label: 'Brake System', labelRu: 'Тормозная система', categoryKey: 'brakes', Icon: Disc3 },
  { id: 'maintenance', label: 'Maintenance & Fluids', labelRu: 'ТО и Жидкости', categoryKey: 'maintenance', Icon: Droplets },
  { id: 'suspension', label: 'Suspension & Steering', labelRu: 'Ходовая и Рулевое', categoryKey: 'suspension', Icon: Wrench },
  { id: 'electrical', label: 'Electrical & Lighting', labelRu: 'Электрика и Оптика', categoryKey: 'electrical', Icon: Zap },
  { id: 'engine', label: 'Engine', labelRu: 'Двигатель', categoryKey: 'engine', Icon: Cog },
  { id: 'transmission', label: 'Transmission', labelRu: 'Трансмиссия', categoryKey: 'transmission', Icon: Settings2 },
  { id: 'climate', label: 'Heating & Cooling', labelRu: 'Климат и Охлаждение', categoryKey: 'climate', Icon: Snowflake },
  { id: 'tuning', label: 'Tuning & Accessories', labelRu: 'Тюнинг и Стайлинг', categoryKey: 'tuning', Icon: Sparkles },
];

export function catalogSystemById(id: string | undefined): CatalogSystem | undefined {
  return CATALOG_SYSTEMS.find((s) => s.id === id);
}
