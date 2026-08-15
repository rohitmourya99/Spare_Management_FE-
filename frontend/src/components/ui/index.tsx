import React from 'react';
import { X, Loader2 } from 'lucide-react';

/* ──────────────────────────────────────────────────
   CARD (Light Theme Modern Enterprise UI with 3D Depth)
────────────────────────────────────────────────── */
export interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  noPadding?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, children, className = '', action, noPadding, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/90 ${noPadding ? '' : 'p-5'} ${className}`}
      style={{ boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)' }}
    >
      {(title || action) && (
        <div className={`flex items-center justify-between ${noPadding ? 'px-5 pt-4 pb-3' : 'mb-4 pb-3'}`}
          style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
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
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed select-none shadow-sm active:translate-y-0.5';

  const variants: Record<string, string> = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white border-b-2 border-indigo-800 shadow-md shadow-indigo-500/20',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90',
    outline: 'bg-white hover:bg-indigo-50/50 text-indigo-600 border border-indigo-200',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white border-b-2 border-rose-800 shadow-md shadow-rose-500/20',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-none',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-b-2 border-emerald-800 shadow-md shadow-emerald-500/20',
  };

  const sizes: Record<string, string> = {
    xs: 'text-[10px] px-2.5 py-1 gap-1',
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-sm px-5 py-2.5 gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
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
   BADGE (High Visibility Light Theme Tints)
────────────────────────────────────────────────── */
export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'sm', dot }) => {
  const styles: Record<string, string> = {
    success: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800',
    danger: 'bg-rose-50 border border-rose-200 text-rose-800',
    info: 'bg-blue-50 border border-blue-200 text-blue-800',
    default: 'bg-slate-100 border border-slate-200 text-slate-800',
    purple: 'bg-purple-50 border border-purple-200 text-purple-800',
  };

  const sizes: Record<string, string> = {
    xs: 'text-[9px] px-1.5 py-px',
    sm: 'text-[10px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
  };

  const dotColors: Record<string, string> = {
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    info: '#2563eb',
    default: '#475569',
    purple: '#7c3aed',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full shadow-2xs ${styles[variant]} ${sizes[size]}`}
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
        style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className={`modal-enter relative w-full ${maxWs[maxWidth]} rounded-2xl text-left overflow-hidden bg-white border border-slate-200 shadow-2xl`}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-5 rounded-full bg-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
              </div>
              {subtitle && <p className="text-xs text-slate-500 mt-1 ml-4 font-medium">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all"
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
   STAT CARD (3D Tactile Light Depth)
────────────────────────────────────────────────── */
export interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  bg?: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
  isActive?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend, onClick, isActive }) => {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`bg-white rounded-2xl p-4 border transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500 hover:shadow-xl cursor-pointer select-none ${
        isActive
          ? 'border-2 border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-lg font-black'
          : 'border-slate-200/90'
      }`}
      style={{
        boxShadow: '0 4px 18px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
      }}
      onClick={() => {
        if (onClick) onClick();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <p className="text-[11px] font-bold text-slate-600 leading-tight max-w-[80%]">{title}</p>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center shrink-0 border border-slate-200/80 shadow-inner">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-2xl font-black ${color} tracking-tight leading-none`}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </p>
      {trend && (
        <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
          <span className={trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
            {trend.value >= 0 ? '+' : ''}{trend.value}
          </span>{' '}
          {trend.label}
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
    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-1 shadow-sm">
      <Icon className="w-6 h-6 text-indigo-600" />
    </div>
    <p className="text-sm font-bold text-slate-800">{title}</p>
    {description && <p className="text-xs text-slate-500 text-center max-w-xs">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
