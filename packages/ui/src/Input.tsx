import React from 'react'

/**
 * Input — form input field with optional label and error state.
 *
 * Designed for light surfaces (bg-surface-raised).
 * For dark-surface contexts (admin shell), pass inputClassName / labelClassName
 * overrides via the respective props.
 */

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?:          string
  error?:          string
  wrapperClassName?: string
  labelClassName?: string
  inputClassName?: string
}

export function Input({
  label,
  error,
  wrapperClassName = '',
  labelClassName   = '',
  inputClassName   = '',
  id,
  ...props
}: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={['flex flex-col gap-1', wrapperClassName].join(' ')}>
      {label && (
        <label
          htmlFor={inputId}
          className={[
            'text-sm font-medium text-text-secondary',
            labelClassName,
          ].join(' ')}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full px-3 py-2 rounded-md border border-border-default',
          'bg-surface-raised text-text-primary',
          'placeholder:text-text-placeholder',
          'focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-brand-default',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          error ? 'border-status-errorBorder focus:ring-status-errorBorder' : '',
          inputClassName,
        ].join(' ')}
        {...props}
      />
      {error && (
        <p className="text-xs text-status-errorText">{error}</p>
      )}
    </div>
  )
}
