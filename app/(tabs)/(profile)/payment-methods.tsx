import PaymentMethodsScreen from '@/components/screens/payment-methods-screen';
import AppErrorBoundary from '@/components/shared/app-error-boundary';

export default function PaymentMethodsRoute() {
  return (
    <AppErrorBoundary label="Payment Methods">
      <PaymentMethodsScreen />
    </AppErrorBoundary>
  );
}
