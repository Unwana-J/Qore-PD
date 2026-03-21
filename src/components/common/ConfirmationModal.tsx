import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getThemeClasses } from '../../lib/theme';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  themeColor?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  themeColor = 'teal'
}) => {
  const theme = getThemeClasses(themeColor);

  const variants = {
    danger: {
      icon: <X className="w-6 h-6 text-red-600" />,
      bg: 'bg-red-50',
      border: 'border-red-100',
      button: 'bg-red-600 hover:bg-red-700 shadow-red-200'
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
    },
    info: {
      icon: <ChevronRight className="w-6 h-6 text-blue-600" />,
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      button: cn(theme.bg, theme.hoverBg, theme.shadow)
    }
  };

  const currentVariant = variants[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative"
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-colors z-10">
              <X className="w-5 h-5" />
            </button>
            <div className="p-8 text-center">
              <div className={cn("w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center border", currentVariant.bg, currentVariant.border)}>
                 {currentVariant.icon}
              </div>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">{title}</h2>
              <p className="mt-4 text-slate-500 text-sm leading-relaxed">
                {message}
              </p>
            </div>
            
            <div className="px-8 pb-8 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
              >
                {cancelLabel}
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                  "flex-1 py-4 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95",
                  currentVariant.button
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
