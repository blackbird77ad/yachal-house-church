import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils/scoreHelpers";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

const Modal = ({ isOpen, onClose, title, children, size = "md", showClose = true }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl animate-slide-up", sizes[size])}>
        {(title || showClose) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700">
            {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h2>}
            {showClose && (
              <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;