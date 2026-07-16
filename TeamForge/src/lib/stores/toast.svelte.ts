export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

class ToastStore {
  toasts = $state<Toast[]>([]);

  show(message: string, type: Toast['type'] = 'info', duration = 3000) {
    const id = Math.random().toString(36).substring(2);
    this.toasts.push({ id, message, type, duration });
    
    setTimeout(() => {
      this.dismiss(id);
    }, duration);
  }

  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  }

  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number) {
    this.show(message, 'warning', duration);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}

export const toast = new ToastStore();
