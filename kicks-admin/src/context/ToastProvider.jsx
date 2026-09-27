import { useState } from 'react';
import { ToastContext } from './toastContextValue';

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    if (!message) return;
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[100] w-[min(420px,calc(100vw-2rem))]">
          <div
            className={`rounded-[18px] border px-4 py-3 text-sm shadow-2xl backdrop-blur-md ${
              toast.type === 'error'
                ? 'border-red-500/40 bg-[#201414] text-red-100'
                : toast.type === 'success'
                  ? 'border-[#1f4a38] bg-[#10271d] text-[#aef5ce]'
                  : 'border-white/10 bg-[#191919] text-[#e8e8e8]'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
