import { Circle, CircleCheck, Clock, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalDocumentBody } from '@/components/screens-components/legal/legal-document-body';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useLegalDocument } from '@/hooks/use-legal';
import { useOrder } from '@/hooks/use-orders';
import { useSupportContacts } from '@/hooks/use-support-contacts';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/services/orders-api';
import { formatOrderNo, type OrderDetail } from '@/services/orders-service';
import {
  calendarDayAsLocalDate,
  type CalendarDay,
  mailtoUrl,
  RETURN_WINDOW_DAYS,
  returnSupportMessage,
  returnWindow,
  telegramUrl,
} from '@/services/return-support';
import { triggerHaptic } from '@/utils/haptics';

export type ReturnPolicyScreenProps = {
  /** The delivered order the buyer wants to return from; absent when the
   *  policy is opened from checkout or Settings. */
  orderId?: string;
};

/**
 * Return conditions: the Refund & Returns Policy, the return window for this
 * order, and a way to reach support with the order already identified.
 *
 * No return request is created here: the backend stores none, so the screen
 * never pretends to have submitted one. Support registers the request.
 */
export default function ReturnPolicyScreen({ orderId }: ReturnPolicyScreenProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const policy = useLegalDocument('REFUND_POLICY');
  const support = useSupportContacts();
  const { state: orderState, order, refresh: refreshOrder } = useOrder(orderId ?? null);
  const [chosenIndex, setChosenIndex] = useState(0);

  const items = order?.items ?? [];
  const chosen = items[Math.min(chosenIndex, Math.max(0, items.length - 1))];
  const orderNo = order ? formatOrderNo(order.id) : '';
  const window = returnWindow(order?.deliveredAt);

  const message = returnSupportMessage(
    order
      ? {
          head: t('returnPolicy.messageOrder', { orderNo, orderId: order.id }),
          product: chosen
            ? chosen.productId
              ? t('returnPolicy.messageProduct', {
                  productName: chosen.title,
                  productId: chosen.productId,
                })
              : t('returnPolicy.messageProductNoId', { productName: chosen.title })
            : undefined,
        }
      : { head: t('returnPolicy.messageGeneral') },
  );
  const subject = order
    ? t('returnPolicy.emailSubject', { orderNo })
    : t('returnPolicy.emailSubjectGeneral');

  const open = (url: string, contact: string) => {
    triggerHaptic('selection');
    Linking.openURL(url).catch(() => {
      toast.danger(t('returnPolicy.openFailed', { contact }));
    });
  };

  // Returns go through Telegram or e-mail only, which carry the order context.
  // The backend still serves a support phone; the app deliberately offers no
  // call here.
  const { email, telegramUsername } = support.contacts;

  return (
    <AppView flex={1} colorName="background" testID="return-policy-screen">
      <AppSettingsHeader
        title={t('returnPolicy.title')}
        fallbackHref={orderId ? '/order-history' : '/explore'}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 24, 40),
          gap: 16,
        }}
      >
        {orderId ? (
          <Card tokens={tokens} testID="return-policy-order">
            {orderState === 'loading' || orderState === 'idle' ? (
              <AppView center style={{ paddingVertical: 8 }}>
                <WheelLoader size={22} color={tokens.text} />
              </AppView>
            ) : !order ? (
              <AppView gap={10}>
                <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
                  {t(orderState === 'error' ? 'returnPolicy.orderLoadError' : 'trackOrder.notFound')}
                </AppText>
                {orderState === 'error' ? (
                  <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={refreshOrder} />
                ) : null}
              </AppView>
            ) : (
              <OrderSummary
                order={order}
                orderNo={orderNo}
                chosenIndex={chosenIndex}
                onChoose={setChosenIndex}
                tokens={tokens}
              />
            )}
          </Card>
        ) : null}

        {/* The two timeframes, side by side: the 10 days apply to change-of-mind
            returns only; defects follow warranty and statutory periods. */}
        <Card tokens={tokens} testID="return-policy-terms">
          <TermRow
            tokens={tokens}
            icon={<Clock size={20} strokeWidth={2.2} color={tokens.brandText} />}
            title={t('returnPolicy.windowTitle', { days: RETURN_WINDOW_DAYS })}
            body={
              window
                ? window.open
                  ? t('returnPolicy.windowUntil', { date: formatDay(window.lastDay) })
                  : t('returnPolicy.windowPassed', { date: formatDay(window.lastDay) })
                : t('returnPolicy.windowNoDate')
            }
            testID="return-policy-window"
          />
          <AppView style={{ height: 1, backgroundColor: tokens.divider }} />
          <TermRow
            tokens={tokens}
            icon={<ShieldAlert size={20} strokeWidth={2.2} color={tokens.brandText} />}
            title={t('returnPolicy.defectTitle')}
            body={t('returnPolicy.defectBody', { days: RETURN_WINDOW_DAYS })}
          />
        </Card>

        <Card tokens={tokens} testID="return-policy-support">
          <AppView gap={4}>
            <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
              {t('returnPolicy.supportTitle')}
            </AppText>
            <AppText family="default" style={{ fontSize: 13, lineHeight: 18, color: tokens.textMuted }}>
              {t(order ? 'returnPolicy.supportBodyOrder' : 'returnPolicy.supportBody')}
            </AppText>
          </AppView>

          {support.loading ? (
            <AppView center style={{ paddingVertical: 8 }}>
              <WheelLoader size={22} color={tokens.text} />
            </AppView>
          ) : telegramUsername || email ? (
            <AppView gap={10}>
              {telegramUsername ? (
                <AppButton
                  testID="return-policy-telegram"
                  title={t('returnPolicy.telegram')}
                  kind="brand"
                  size="md"
                  fullWidth
                  onPress={() => open(telegramUrl(telegramUsername, message), `@${telegramUsername}`)}
                />
              ) : null}
              {email ? (
                <AppButton
                  testID="return-policy-email"
                  title={t('returnPolicy.email')}
                  kind="secondary"
                  variant="outline"
                  size="md"
                  fullWidth
                  onPress={() => open(mailtoUrl(email, subject, message), email)}
                />
              ) : null}
            </AppView>
          ) : (
            <AppText testID="return-policy-support-unavailable" family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
              {t('returnPolicy.supportUnavailable')}
            </AppText>
          )}

          <AppText family="default" style={{ fontSize: 12, lineHeight: 17, color: tokens.textMuted }}>
            {t('returnPolicy.noRequestNote')}
          </AppText>
        </Card>

        {/* The policy itself, as the backend publishes it. */}
        <AppView testID="return-policy-document" style={{ paddingTop: 4 }}>
          {policy.state === 'loading' ? (
            <AppView center style={{ paddingVertical: 16 }}>
              <WheelLoader size={26} color={tokens.text} />
            </AppView>
          ) : policy.state === 'success' && policy.document ? (
            <LegalDocumentBody doc={policy.document} />
          ) : (
            <AppView gap={10} align="flex-start">
              <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
                {policy.state === 'error' ? (policy.error ?? t('legal.loadError')) : t('legal.unavailable')}
              </AppText>
              <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={policy.refresh} />
            </AppView>
          )}
        </AppView>
      </ScrollView>
    </AppView>
  );
}

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

/** A Tashkent calendar day in the app's language, the same day in any device zone. */
function formatDay(day: CalendarDay): string {
  return formatDate(calendarDayAsLocalDate(day).toISOString());
}

function Card({ tokens, testID, children }: { tokens: Tokens; testID?: string; children: React.ReactNode }) {
  return (
    <AppView
      testID={testID}
      gap={14}
      style={{
        backgroundColor: tokens.card,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 16,
        padding: 16,
      }}
    >
      {children}
    </AppView>
  );
}

function TermRow({
  tokens,
  icon,
  title,
  body,
  testID,
}: {
  tokens: Tokens;
  icon: React.ReactNode;
  title: string;
  body: string;
  testID?: string;
}) {
  return (
    <AppView row gap={12} testID={testID}>
      <AppView center rounded={999} style={{ width: 36, height: 36, backgroundColor: tokens.brandSoft, flexShrink: 0 }}>
        {icon}
      </AppView>
      <AppView flex={1} gap={2}>
        <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.text }}>
          {title}
        </AppText>
        <AppText family="default" style={{ fontSize: 12.5, lineHeight: 17, color: tokens.textMuted }}>
          {body}
        </AppText>
      </AppView>
    </AppView>
  );
}

function OrderSummary({
  order,
  orderNo,
  chosenIndex,
  onChoose,
  tokens,
}: {
  order: OrderDetail;
  orderNo: string;
  chosenIndex: number;
  onChoose: (index: number) => void;
  tokens: Tokens;
}) {
  const { t } = useTranslation();
  const window = returnWindow(order.deliveredAt);
  const received = window ? formatDay(window.receivedDay) : '';
  const several = order.items.length > 1;

  return (
    <AppView gap={12}>
      <AppView row justify="space-between" align="center" gap={12}>
        <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
          {t('returnPolicy.order')}
        </AppText>
        <AppText family="mono" weight="bold" style={{ fontSize: 14, color: tokens.text }}>
          {orderNo}
        </AppText>
      </AppView>
      {received ? (
        <AppText testID="return-policy-received" family="default" style={{ fontSize: 13, color: tokens.text }}>
          {t('returnPolicy.receivedOn', { date: received })}
        </AppText>
      ) : null}

      {several ? (
        <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
          {t('returnPolicy.chooseItem')}
        </AppText>
      ) : null}
      <AppView gap={several ? 6 : 0} accessibilityRole={several ? 'radiogroup' : undefined}>
        {order.items.map((line, index) =>
          several ? (
            <AppPressableView
              key={line.id}
              testID={`return-policy-item-${index}`}
              androidRipple={false}
              onPress={() => {
                triggerHaptic('selection');
                onChoose(index);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: index === chosenIndex }}
              row
              align="center"
              gap="md"
              py="sm"
              fillContainer
            >
              {index === chosenIndex ? (
                <CircleCheck size={20} strokeWidth={2.2} color={tokens.brandText} />
              ) : (
                <Circle size={20} strokeWidth={2} color={tokens.border} />
              )}
              <AppText family="default" style={{ fontSize: 14, color: tokens.text, flex: 1 }}>
                {line.title}
              </AppText>
            </AppPressableView>
          ) : (
            <AppText key={line.id} family="default" weight="semibold" style={{ fontSize: 14, color: tokens.text }}>
              {line.title}
            </AppText>
          ),
        )}
      </AppView>
    </AppView>
  );
}
