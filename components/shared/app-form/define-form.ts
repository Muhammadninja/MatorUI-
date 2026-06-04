import { z, type ZodTypeAny } from 'zod';

import type { AnyField, FormConfig } from './types';

/**
 * Single-source field definition that can include defaults and per-field schema.
 */
export type FieldDef<TValues> = AnyField<TValues> & {
  /** Default value for this field */
  defaultValue?: any;
  /** Zod schema fragment for this field */
  schema?: ZodTypeAny;
};

export type DefineFormResult<TValues> = {
  config: FormConfig<TValues>;
  defaultValues: TValues;
  /** Zod schema for the entire form; may include superRefine refinements */
  schema?: ZodTypeAny;
};

/**
 * Build { config, defaultValues, schema } from a single array of FieldDef.
 * - Reduces redundancy by colocating defaults and validation next to UI config.
 */
export function defineForm<TValues extends Record<string, any>>(
  fields: FieldDef<TValues>[],
  options?: {
    sections?: FormConfig<TValues>['sections'];
    /** Optional form-level validation for cross-field rules */
    superRefine?: (vals: TValues, ctx: z.RefinementCtx) => void;
  },
): DefineFormResult<TValues> {
  const config: FormConfig<TValues> = {
    fields: fields.map(({ defaultValue, schema, ...ui }) => ui) as any,
    sections: options?.sections,
  };

  const defaultValues = fields.reduce((acc, f) => {
    // Handle row fields - extract defaults from nested fields
    if ('fields' in f && f.type === 'row') {
      f.fields.forEach((childField: any) => {
        if (childField.name && childField.defaultValue !== undefined) {
          (acc as any)[childField.name as string] = childField.defaultValue;
        }
      });
    } else if ('name' in f && f.name) {
      (acc as any)[f.name as string] = (f as any).defaultValue;
    }
    return acc;
  }, {} as TValues);

  const shape: Record<string, ZodTypeAny> = {};

  for (const f of fields) {
    // Handle row fields - extract schemas from nested fields
    if ('fields' in f && f.type === 'row') {
      (f.fields as any[]).forEach((childField: any) => {
        if (childField.name && childField.schema) {
          shape[childField.name as string] = childField.schema;
        }
      });
    } else if ('name' in f && f.name && (f as any).schema) {
      shape[f.name as string] = (f as any).schema;
    }
  }

  let schema: ZodTypeAny | undefined = Object.keys(shape).length ? z.object(shape) : undefined;

  if (schema && options?.superRefine) {
    // Apply form-level cross-field validation
    schema = (schema as ZodTypeAny).superRefine(options.superRefine as any);
  }
  return { config, defaultValues, schema };
}
