import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { defaultFieldRegistry, type FieldRegistry } from './field-registry';
import type { AnyField, AppFormProps } from './types';

function isVisible<TValues>(field: AnyField<TValues>, values: TValues) {
  // Row fields don't have visibleIf
  if ('fields' in field && field.type === 'row') return true;
  return 'visibleIf' in field && field.visibleIf ? !!field.visibleIf(values) : true;
}

export function AppForm<TValues extends Record<string, any>>({
  config,
  defaultValues,
  schema,
  onSubmit,
  onChange,
  mode = 'onSubmit',
  disabled,
  submitLabel = 'Submit',
  footer,
  registry: registryOverrides,
  fieldGap = 8,
  sectionFieldGap = 8,
  formRef,
}: AppFormProps<TValues>) {
  const methods = useForm<TValues>({
    defaultValues: defaultValues as any,
    mode,
    resolver: schema ? (zodResolver(schema as any) as any) : undefined,
    shouldUnregister: true,
    criteriaMode: 'firstError',
  });

  const { handleSubmit, watch, control, formState } = methods;

  // Expose form methods to parent via ref
  useEffect(() => {
    if (formRef) formRef.current = methods;
    return () => {
      if (formRef) formRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent on change
  useEffect(() => {
    if (!onChange) return;
    const sub = watch(((values: any) => onChange(values as TValues)) as any) as {
      unsubscribe: () => void;
    };
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  const registry = useMemo<FieldRegistry>(
    () =>
      ({
        ...defaultFieldRegistry,
        ...(registryOverrides ?? {}),
      }) as FieldRegistry,
    [registryOverrides],
  );

  const fieldsByName = useMemo(() => {
    const map = new Map<string, AnyField<TValues>>();
    config.fields.forEach((f) => {
      if ('name' in f && f.name) {
        map.set(f.name as string, f);
      }
    });
    return map;
  }, [config.fields]);

  const renderField = useCallback(
    (field: AnyField<TValues> | any, index?: number) => {
      // Handle row layout
      if ('fields' in field && field.type === 'row') {
        const rowField = field as any;
        const gap = rowField.gap ?? 12;
        const key = `row-${index ?? Math.random()}`;
        return (
          <AppView key={key} row gap={gap}>
            {rowField.fields.map((childField: any, childIndex: number) => {
              const fieldType = childField.type as keyof FieldRegistry;
              const Renderer: any = registry[fieldType];
              if (!Renderer) return null;
              const isDisabled =
                !!disabled || ('disabled' in childField ? !!childField.disabled : false);
              const childKey =
                'name' in childField ? String(childField.name) : `child-${childIndex}`;
              return (
                <AppView key={childKey} flex={1}>
                  <Renderer field={childField} control={control} disabled={isDisabled} />
                </AppView>
              );
            })}
          </AppView>
        );
      }

      // Regular field
      const fieldType = field.type as keyof FieldRegistry;
      const Renderer: any = registry[fieldType];
      if (!Renderer) return null;
      const isDisabled = !!disabled || ('disabled' in field ? !!field.disabled : false);
      const key = 'name' in field ? String(field.name) : `field-${index ?? Math.random()}`;
      return <Renderer key={key} field={field} control={control} disabled={isDisabled} />;
    },
    [registry, control, disabled],
  );

  const watchedValues = useWatch({ control }) as TValues | undefined;
  const values = watchedValues ?? (defaultValues as TValues);

  // Sections or flat
  const hasSections = !!config.sections?.length;

  return (
    <FormProvider {...methods}>
      <AppView gap={12}>
        {hasSections ? (
          config.sections!.map((sec, idx) => (
            <AppView key={idx} gap={8} p={12} rounded={12} colorName={'card' as any}>
              {sec.title ? <AppText textVariant="h4">{sec.title}</AppText> : null}
              {sec.description ? (
                <AppText textVariant="bodyXs" muted>
                  {sec.description}
                </AppText>
              ) : null}
              <AppView gap={sectionFieldGap}>
                {sec.fields.map((fn, idx) => {
                  const f = fieldsByName.get(fn);
                  if (!f) return null;
                  if (!isVisible(f, values)) return null;
                  return renderField(f, idx);
                })}
              </AppView>
            </AppView>
          ))
        ) : (
          <AppView gap={fieldGap}>
            {config.fields.filter((f) => isVisible(f, values)).map((f, idx) => renderField(f, idx))}
          </AppView>
        )}
        {typeof footer === 'function'
          ? footer({
              submit: handleSubmit(onSubmit as any),
              formState: formState as any,
              methods: methods as any,
            })
          : (footer ?? (
              <AppButton
                title={submitLabel}
                onPress={handleSubmit(onSubmit as any)}
                disabled={disabled || formState.isSubmitting}
              />
            ))}
      </AppView>
    </FormProvider>
  );
}

export default AppForm;
