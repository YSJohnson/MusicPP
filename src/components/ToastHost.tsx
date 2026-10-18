import { useToast } from '../store/toast';

export function ToastHost() {
  const toasts = useToast((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
