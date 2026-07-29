import React from 'react';
import { X, Loader2 } from 'lucide-react';

/* ──────────────────────────────────────────────────
   CARD
────────────────────────────────────────────────── */
export interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, children, className = '', action, noPadding }) => {
  return (
    <div className={`glass-panel rounded-2xl ${noPadding ? '' : 'p-5'} ${className}`}
      style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.25)' }}>
      {(title || action) && (
        <div className={`flex items-center justify-between ${noPadding ? 'px-5 pt-4 pb-3' : 'mb-4 pb-3'}`}
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            {title && <h3 className="text-sm font-bold text-slate-100 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {noPadding ? children : <div>{children}</div>}
    </div>
  );
};

/* ──────────────────────────────────────────────────
   BUTTON
────────────────────────────────────────────────── */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed select-none';

  const variants: Record<string, string> = {
    primary: 'text-white btn-primary',
    secondary: 'text-slate-200 hover:text-white transition-colors',
    outline: 'border text-indigo-400 hover:text-indigo-300 transition-colors',
    danger: 'text-white',
    ghost: 'text-slate-400 hover:text-white transition-colors',
    success: 'text-white',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {},
    secondary: {
      background: 'rgba(30,41,70,0.7)',
      border: '1px solid rgba(99,102,241,0.15)',
    },
    outline: {
      background: 'rgba(99,102,241,0.06)',
      border: '1px solid rgba(99,102,241,0.3)',
    },
    danger: {
      background: 'linear-gradient(135deg,#ef4444,#dc2626)',
      boxShadow: '0 4px 14px rgba(239,68,68,0.3)',
    },
    ghost: {
      background: 'transparent',
    },
    success: {
      background: 'linear-gradient(135deg,#10b981,#059669)',
      boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
    },
  };

  const sizes: Record<string, string> = {
    xs: 'text-[10px] px-2 py-1 gap-1',
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-sm px-5 py-2.5 gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      style={variantStyles[variant]}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

/* ──────────────────────────────────────────────────
   BADGE
────────────────────────────────────────────────── */
export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'sm', dot }) => {
  const styles: Record<string, React.CSSProperties> = {
    success: {
      background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1))',
      border: '1px solid rgba(16,185,129,0.3)',
      color: '#34d399',
    },
    warning: {
      background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(217,119,6,0.1))',
      border: '1px solid rgba(245,158,11,0.3)',
      color: '#fbbf24',
    },
    danger: {
      background: 'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(220,38,38,0.1))',
      border: '1px solid rgba(239,68,68,0.3)',
      color: '#f87171',
    },
    info: {
      background: 'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(37,99,235,0.1))',
      border: '1px solid rgba(59,130,246,0.3)',
      color: '#60a5fa',
    },
    default: {
      background: 'rgba(30,41,59,0.8)',
      border: '1px solid rgba(71,85,105,0.4)',
      color: '#94a3b8',
    },
    purple: {
      background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(109,40,217,0.1))',
      border: '1px solid rgba(139,92,246,0.3)',
      color: '#c4b5fd',
    },
  };

  const sizes: Record<string, string> = {
    xs: 'text-[9px] px-1.5 py-px',
    sm: 'text-[10px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
  };

  const dotColors: Record<string, string> = {
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    info: '#60a5fa',
    default: '#94a3b8',
    purple: '#c4b5fd',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${sizes[size]}`}
      style={styles[variant]}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: dotColors[variant] }} />
      )}
      {children}
    </span>
  );
};

/* ──────────────────────────────────────────────────
   MODAL
────────────────────────────────────────────────── */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
}) => {
  if (!isOpen) return null;

  const maxWs: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 transition-opacity"
        style={{ background: 'rgba(4,8,16,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className={`modal-enter relative w-full ${maxWs[maxWidth]} rounded-2xl text-left overflow-hidden`}
          style={{
            background: 'linear-gradient(180deg,rgba(14,20,38,0.98) 0%,rgba(10,14,28,0.98) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full"
                  style={{ background: 'linear-gradient(180deg,#6366f1,#8b5cf6)' }} />
                <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              </div>
              {subtitle && <p className="text-xs text-slate-500 mt-1 ml-3.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-all"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────
   STAT CARD (used on Dashboard)
────────────────────────────────────────────────── */
export interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  bg: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, bg, trend, onClick }) => {
  return (
    <div
      className={`stat-card rounded-2xl p-4 cursor-default ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: bg,
        border: `1px solid rgba(255,255,255,0.07)`,
        boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold text-slate-400 leading-tight max-w-[80%]">{title}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0,0,0,0.2)' }}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-3xl font-black ${color} tracking-tight leading-none`}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </p>
      {trend && (
        <p className="text-[10px] text-slate-500 mt-1.5">
          <span className={trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {trend.value >= 0 ? '+' : ''}{trend.value}
          </span>
          {' '}{trend.label}
        </p>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────
   EMPTY STATE
────────────────────────────────────────────────── */
export const EmptyState: React.FC<{
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-1"
      style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
      <Icon className="w-7 h-7 text-slate-600" />
    </div>
    <p className="text-sm font-semibold text-slate-400">{title}</p>
    {description && <p className="text-xs text-slate-600 text-center max-w-xs">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
