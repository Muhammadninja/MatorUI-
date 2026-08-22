import type { CheckoutSheetValues } from '@/components/shared/global-modal-host';
import {
  modalService,
  type ModalPayload,
} from '@/services/global-modal-service/global-modal.service';

type CheckoutSheetPayload = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  paymentMethods?: string[];
  defaultValues?: Partial<CheckoutSheetValues>;
  onSubmit?: (values: CheckoutSheetValues) => void;
  onCancel?: () => void;
};

type AuthRequiredPayload = {
  title?: string;
  message?: string;
  onAuthenticated?: () => void;
  onCancel?: () => void;
  redirectTo?: string;
};

export type ActionSheetOption = {
  label: string;
  onPress?: () => void;
  /** Renders the row in the error color (e.g. "Clear chat"). */
  destructive?: boolean;
};

type ActionSheetPayload = {
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
  onCancel?: () => void;
};

export function useGlobalModal() {
  return {
    openModal: (name: string, payload?: ModalPayload) => modalService.openModal(name, payload),
    closeModal: () => modalService.closeModal(),
    openConfirm: (payload?: ModalPayload) => modalService.openModal('confirmAction', payload),
    openCheckoutSheet: (payload?: CheckoutSheetPayload) =>
      modalService.openModal('checkoutSheet', payload),
    openAuthRequired: (payload?: AuthRequiredPayload) =>
      modalService.openModal('authRequired', payload),
    openActionSheet: (payload: ActionSheetPayload) =>
      modalService.openModal('actionSheet', payload),
  };
}

export default useGlobalModal;
