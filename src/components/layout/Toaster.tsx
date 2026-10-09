import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type ToastKind } from '../../stores/useToastStore';

const KIND_STYLES: Record<ToastKind, { color: string; Icon: typeof Info }> = {
  success: { color: 'var(--green)', Icon: CheckCircle2 },
  error: { color: 'var(--red)', Icon: AlertTriangle },
  info: { color: 'var(--cyan)', Icon: Info },
};

export const Toaster: React.FC = () => {
  const { toasts, dismiss } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-8 right-4 z-[60] flex flex-col items-end space-y-2 font-sans text-xs pointer-events-none">
      {toasts.map((t) => {
        const { color, Icon } = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto w-[320px] bg-[var(--panel)] border border-[var(--border)] rounded-md shadow-2xl p-3 flex items-start space-x-2.5"
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-[var(--text)]">{t.title}</p>
              {t.message && <p className="text-[11px] text-[var(--muted)] break-words">{t.message}</p>}
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="text-[11px] font-semibold text-[var(--purple)] hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="p-0.5 text-[var(--muted-2)] hover:text-[var(--text)] rounded transition shrink-0"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
