import { UZ_BRANDS, getModelsForBrand } from '@/services/uz-vehicle-catalog';
import AppTextField from '@/components/shared/app-text-field';
import { AppView } from '@/components/shared/app-view';

export type VehicleFieldKey =
  | 'year'
  | 'make'
  | 'model'
  | 'trim'
  | 'nickname'
  | 'mileage'
  | 'plate'
  | 'vin';

export type VehicleFieldValues = Record<VehicleFieldKey, string>;

export type VehicleFieldErrors = Partial<Record<VehicleFieldKey, string>>;

type AutoCapitalize = 'none' | 'sentences' | 'words' | 'characters';

type FieldConfig = {
  key: VehicleFieldKey;
  label: string;
  placeholder: string;
  autoCapitalize?: AutoCapitalize;
  flex?: number;
  required?: boolean;
};

type FieldRow = FieldConfig | FieldConfig[];

// Pull the top brand + a popular model from the UZ catalog so the
// placeholder reflects what most users actually own here (Chevrolet
// Cobalt) instead of a generic "Toyota". Falls back to literals if the
// catalog is empty in some bundling edge case.
const PLACEHOLDER_BRAND = UZ_BRANDS.find((b) => b.tier === 'uz_top')?.label ?? 'Chevrolet';
const PLACEHOLDER_MODEL =
  getModelsForBrand(UZ_BRANDS.find((b) => b.tier === 'uz_top')?.id ?? 'chevrolet')[0]?.label ??
  'Cobalt';

const SCHEMA: FieldRow[] = [
  [
    { key: 'year', label: 'Year', placeholder: '2024', flex: 1, required: true },
    {
      key: 'make',
      label: 'Make',
      placeholder: PLACEHOLDER_BRAND,
      autoCapitalize: 'words',
      flex: 2,
      required: true,
    },
  ],
  {
    key: 'model',
    label: 'Model',
    placeholder: PLACEHOLDER_MODEL,
    autoCapitalize: 'words',
    required: true,
  },
  [
    { key: 'trim', label: 'Trim', placeholder: 'Premier', autoCapitalize: 'words', flex: 1 },
    { key: 'nickname', label: 'Nickname', placeholder: 'Daily driver', flex: 1 },
  ],
  { key: 'mileage', label: 'Mileage', placeholder: '52,840' },
  { key: 'plate', label: 'Plate', placeholder: '01A123BC', autoCapitalize: 'characters' },
  // VIN is entered manually in this form field.
  { key: 'vin', label: 'VIN', placeholder: '17-character VIN', autoCapitalize: 'characters' },
];

/** Exposed so the wizard can know which keys are required without duplicating the schema. */
export const REQUIRED_FIELD_KEYS: VehicleFieldKey[] = SCHEMA.flatMap((row) =>
  Array.isArray(row) ? row.filter((c) => c.required).map((c) => c.key) : row.required ? [row.key] : [],
);

const FIELD_CHROME = {
  containerRounded: 16,
  containerColorName: 'card' as const,
  containerBorderName: 'border' as const,
};

export type AddVehicleFieldsProps = {
  values: VehicleFieldValues;
  onChange: (key: VehicleFieldKey, value: string) => void;
  errors?: VehicleFieldErrors;
  /** If provided, only renders rows whose fields all match. Lets each wizard step reuse this. */
  only?: VehicleFieldKey[];
  /** Outer margin top. */
  mt?: number;
};

function filterSchema(schema: FieldRow[], only?: VehicleFieldKey[]): FieldRow[] {
  if (!only || only.length === 0) return schema;
  const allowed = new Set(only);
  const rows: FieldRow[] = [];
  for (const row of schema) {
    if (Array.isArray(row)) {
      const kept = row.filter((cfg) => allowed.has(cfg.key));
      if (kept.length > 0) rows.push(kept.length === 1 ? kept[0] : kept);
    } else if (allowed.has(row.key)) {
      rows.push(row);
    }
  }
  return rows;
}

export function AddVehicleFields({ values, onChange, errors, only, mt }: AddVehicleFieldsProps) {
  const rows = filterSchema(SCHEMA, only);

  return (
    <AppView gap="lg" mt={mt}>
      {rows.map((row, i) =>
        Array.isArray(row) ? (
          <AppView key={`row-${i}`} row gap="md">
            {row.map((cfg) => (
              <AppView key={cfg.key} flex={cfg.flex ?? 1}>
                <FieldRenderer
                  cfg={cfg}
                  value={values[cfg.key]}
                  onChange={onChange}
                  error={errors?.[cfg.key]}
                />
              </AppView>
            ))}
          </AppView>
        ) : (
          <FieldRenderer
            key={row.key}
            cfg={row}
            value={values[row.key]}
            onChange={onChange}
            error={errors?.[row.key]}
          />
        ),
      )}
    </AppView>
  );
}

type FieldRendererProps = {
  cfg: FieldConfig;
  value: string;
  onChange: (key: VehicleFieldKey, value: string) => void;
  error?: string;
};

function FieldRenderer({ cfg, value, onChange, error }: FieldRendererProps) {
  return (
    <AppTextField
      label={cfg.required ? `${cfg.label} *` : cfg.label}
      placeholder={cfg.placeholder}
      value={value}
      onChangeText={(v) => onChange(cfg.key, v)}
      autoCapitalize={cfg.autoCapitalize}
      errorText={error}
      {...FIELD_CHROME}
    />
  );
}

export default AddVehicleFields;
