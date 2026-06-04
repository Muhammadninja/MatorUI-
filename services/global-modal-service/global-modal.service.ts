export type ModalPayload = Record<string, unknown> | undefined;

export type GlobalModalState = {
  name: string;
  payload?: ModalPayload;
} | null;

type ModalListener = (modalState: GlobalModalState) => void;

class GlobalModalService {
  private listener: ModalListener | null = null;

  register(listener: ModalListener) {
    this.listener = listener;
    return () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    };
  }

  openModal(name: string, payload?: ModalPayload) {
    this.listener?.({ name, payload });
  }

  closeModal() {
    this.listener?.(null);
  }
}

export const modalService = new GlobalModalService();

export default modalService;
