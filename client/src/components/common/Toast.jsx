import { useState, useEffect, useCallback, useMemo } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../../utils/scoreHelpers";

const icons = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertCircle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

const styles = {
  success: "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800",
  error: "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800",
  warning: "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800",
  info: "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800",
};

export const Toast = ({ id, type = "info", title, message, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border shadow-lg w-80 animate-slide-up", styles[type])}>
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</p>}
        {message && <p className="text-sm text-gray-600 dark:text-slate-300 mt-0.5">{message}</p>}
      </div>
      <button onClick={() => onClose(id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer = ({ toasts, onClose }) => (
  <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    {toasts.map((toast) => (
      <Toast key={toast.id} {...toast} onClose={onClose} />
    ))}
  </div>
);

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useMemo(() => ({
    success: (title, message) => addToast({ type: "success", title, message }),
    error: (title, message) => addToast({ type: "error", title, message }),
    warning: (title, message) => addToast({ type: "warning", title, message }),
    info: (title, message) => addToast({ type: "info", title, message }),
  }), [addToast]);

  return { toasts, toast, removeToast };
};

export default Toast;
