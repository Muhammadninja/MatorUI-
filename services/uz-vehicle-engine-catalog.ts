import type { VehicleEngine } from '@/services/uz-vehicle-catalog';

export const UZ_ENGINES: VehicleEngine[] = [
  // GM family used across Cobalt / Nexia / Spark / Tracker
  {
    id: 'b15d2-na',
    label: '1.5L On-Turbo (B15D2)',
    type: 'na',
    displacement: 1.5,
    transmissions: ['manual', 'automatic'],
    oemCatalogScope: 'gm-uz-b15d2-na',
  },
  {
    id: 'b15d2-turbo',
    label: '1.5L Turbo (B15D2)',
    type: 'turbo',
    displacement: 1.5,
    transmissions: ['cvt', 'automatic'],
    oemCatalogScope: 'gm-uz-b15d2-turbo',
  },
  {
    id: 'b12d2',
    label: '1.2L (B12D2)',
    type: 'na',
    displacement: 1.2,
    transmissions: ['manual', 'automatic'],
    oemCatalogScope: 'gm-uz-b12d2',
  },
  {
    id: 'lcv-1-3',
    label: '1.3L LCV',
    type: 'na',
    displacement: 1.3,
    transmissions: ['manual'],
    oemCatalogScope: 'gm-uz-lcv',
  },
  // Malibu family
  {
    id: 'malibu-1-5t',
    label: '1.5L Turbo (LFV)',
    type: 'turbo',
    displacement: 1.5,
    transmissions: ['automatic'],
    oemCatalogScope: 'gm-malibu-lfv',
  },
  {
    id: 'malibu-2-0t',
    label: '2.0L Turbo (LTG)',
    type: 'turbo',
    displacement: 2.0,
    transmissions: ['automatic'],
    oemCatalogScope: 'gm-malibu-ltg',
  },
  // Lacetti
  {
    id: 'lacetti-1-6',
    label: '1.6L (F16D3)',
    type: 'na',
    displacement: 1.6,
    transmissions: ['manual', 'automatic'],
    oemCatalogScope: 'gm-lacetti-f16d3',
  },
  // BYD EV/PHEV
  {
    id: 'byd-blade-ev',
    label: 'Blade Battery EV',
    type: 'ev',
    transmissions: ['automatic'],
    oemCatalogScope: 'byd-blade-ev',
  },
  {
    id: 'byd-dmi',
    label: 'DM-i PHEV',
    type: 'phev',
    displacement: 1.5,
    transmissions: ['cvt'],
    oemCatalogScope: 'byd-dmi',
  },
];
