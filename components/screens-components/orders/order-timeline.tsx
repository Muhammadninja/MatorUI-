import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { ORDER_STEP_I18N, type OrderDetail } from '@/services/orders-service';

/** The order's vertical timeline: its steps, lit up to the current one. */
export function OrderTimeline({ order }: { order: Pick<OrderDetail, 'steps' | 'currentStepIndex'> }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  return (
    <AppView style={{ paddingLeft: 4 }}>
      {order.steps.map((step, i) => {
        const isLast = i === order.steps.length - 1;
        const done = i <= order.currentStepIndex;
        const active = i === order.currentStepIndex;
        return (
          <AppView
            key={step.key}
            row
            style={{ gap: 14, minHeight: isLast ? 30 : 62 }}
          >
            {/* Dot + connector column */}
            <AppView style={{ alignItems: 'center' }}>
              <AppView
                center
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  backgroundColor: done ? tokens.brandBg : 'transparent',
                  borderWidth: done ? 0 : 2,
                  borderColor: done ? tokens.brandBg : tokens.border,
                  flexShrink: 0,
                }}
              >
                {done ? (
                  <AppText
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: tokens.onBrand,
                    }}
                  >
                    ✓
                  </AppText>
                ) : null}
              </AppView>
              {!isLast ? (
                <AppView
                  style={{
                    flex: 1,
                    width: 2,
                    backgroundColor: done ? tokens.brandBg : tokens.border,
                    marginTop: 2,
                  }}
                />
              ) : null}
            </AppView>

            {/* Label + sub */}
            <AppView style={{ paddingBottom: 8 }}>
              <AppText
                family="accent"
                weight={active ? 'bold' : 'semibold'}
                style={{
                  fontSize: 15,
                  color: done ? tokens.text : tokens.textMuted,
                }}
              >
                {t(ORDER_STEP_I18N[step.key], { defaultValue: step.label })}
              </AppText>
              <AppText
                family="default"
                style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}
              >
                {step.caption}
              </AppText>
            </AppView>
          </AppView>
        );
      })}
    </AppView>
  );
}
