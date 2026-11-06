// Backend `ApiCatalogPart` shape (nested brand/category, snake_case fields) so
// HttpCatalogTransport maps it correctly — `brand.name` drives the filter chip.
// `units_sold` powers the vehicle-bestsellers ranking (see the parts handler).
// Every seeded part fits the demo Chevrolet Cobalt (UZ market), so the garage
// "Shop parts that fit" screen renders a populated bestsellers list.
const BRAKE_PARTS = [
  { id: 'brembo-fp', title: 'Brembo Front Brake Pads',
    brand: { id: 'brembo', name: 'Brembo' }, category: { id: 'brakes', name: 'Brake System' },
    oem_numbers: ['BREMBO P59049'], price_label: '$89.00', in_stock: true, region: 'europe', units_sold: 1240,
    images: ['https://cdn.mator.local/parts/brembo-fp.png'],
    specs: [{ label: 'Position', value: 'Front axle' }], features: ['Low-dust compound', 'OE-spec fitment'] },
  { id: 'bosch-rotor', title: 'Bosch Brake Rotor',
    brand: { id: 'bosch', name: 'Bosch' }, category: { id: 'brakes', name: 'Brake System' },
    oem_numbers: ['BOSCH 0986479R89'], price_label: '$54.50', in_stock: true, region: 'europe', units_sold: 870,
    images: ['https://cdn.mator.local/parts/bosch-rotor.png'],
    specs: [{ label: 'Diameter', value: '256 mm' }], features: ['Vented', 'Anti-corrosion coating'] },
];

const FILTER_PARTS = [
  { id: 'mann-oil-filter', title: 'MANN Oil Filter W 71/2',
    brand: { id: 'mann', name: 'MANN-FILTER' }, category: { id: 'filters', name: 'Filters' },
    oem_numbers: ['MANN W712'], price_label: '$8.90', in_stock: true, region: 'europe', units_sold: 2100,
    images: ['https://cdn.mator.local/parts/mann-oil-filter.png'],
    specs: [{ label: 'Type', value: 'Spin-on' }], features: ['OE-spec media', 'Anti-drain valve'] },
  { id: 'mann-air-filter', title: 'MANN Air Filter C 26 168',
    brand: { id: 'mann', name: 'MANN-FILTER' }, category: { id: 'filters', name: 'Filters' },
    oem_numbers: ['MANN C26168'], price_label: '$12.40', in_stock: true, region: 'europe', units_sold: 1580,
    images: ['https://cdn.mator.local/parts/mann-air-filter.png'],
    specs: [{ label: 'Shape', value: 'Panel' }], features: ['High dust capacity'] },
];

const IGNITION_PARTS = [
  { id: 'ngk-spark-plugs', title: 'NGK Spark Plugs (set of 4)',
    brand: { id: 'ngk', name: 'NGK' }, category: { id: 'ignition', name: 'Ignition' },
    oem_numbers: ['NGK BKR6E'], price_label: '$18.00', in_stock: true, region: 'korea', units_sold: 1960,
    images: ['https://cdn.mator.local/parts/ngk-spark-plugs.png'],
    specs: [{ label: 'Gap', value: '1.0 mm' }], features: ['Nickel electrode', 'Set of 4'] },
];

const SERVICE_PARTS = [
  { id: 'varta-battery', title: 'Varta Blue Dynamic 60Ah Battery',
    brand: { id: 'varta', name: 'Varta' }, category: { id: 'batteries', name: 'Batteries' },
    oem_numbers: ['VARTA D59'], price_label: '$96.00', in_stock: true, region: 'europe', units_sold: 640,
    images: ['https://cdn.mator.local/parts/varta-battery.png'],
    specs: [{ label: 'Capacity', value: '60 Ah' }], features: ['540A cold-crank'] },
  { id: 'bosch-wiper', title: 'Bosch Aerotwin Wiper Blades',
    brand: { id: 'bosch', name: 'Bosch' }, category: { id: 'wipers', name: 'Wipers' },
    oem_numbers: ['BOSCH A designation'], price_label: '$22.50', in_stock: true, region: 'europe', units_sold: 1120,
    images: ['https://cdn.mator.local/parts/bosch-wiper.png'],
    specs: [{ label: 'Length', value: '600/400 mm' }], features: ['Beam design', 'All-season rubber'] },
];

export const CATALOG = {
  brakes: BRAKE_PARTS,
  filters: FILTER_PARTS,
  ignition: IGNITION_PARTS,
  batteries: [SERVICE_PARTS[0]],
  wipers: [SERVICE_PARTS[1]],
};

// Flat list / id lookup. `ALL_PARTS` is every seeded part (used for search and
// the vehicle-fit / bestsellers list); `PARTS_BY_ID` backs the detail endpoint.
export const ALL_PARTS = Object.values(CATALOG).flat();
export const PARTS_BY_ID = Object.fromEntries(ALL_PARTS.map((p) => [p.id, p]));
