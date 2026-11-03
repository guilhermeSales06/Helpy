import { useId, useState } from 'react';
import { errorClass, inputClass, labelClass } from './field-styles';
import type { TextFieldProps } from './text-field';

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

type PasswordFieldProps = Omit<TextFieldProps, 'type'> & {
  /** When set, the parent controls visibility and the eye button is hidden. */
  reveal?: boolean;
};

export function PasswordField({
  label,
  error,
  reveal,
  className = '',
  ...props
}: PasswordFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [toggled, setToggled] = useState(false);
  const controlled = reveal !== undefined;
  const visible = controlled ? reveal : toggled;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClass} ${controlled ? '' : 'pr-12'} ${className}`}
          {...props}
        />
        {controlled ? null : (
          <button
            type="button"
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setToggled((v) => !v)}
            className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-full text-secondary outline-none hover:bg-[#efece9] focus-visible:ring-4 focus-visible:ring-focus"
          >
            {visible ? (
              <svg {...iconProps}>
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13 13 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20" />
              </svg>
            ) : (
              <svg {...iconProps}>
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error ? (
        <span id={errorId} className={errorClass}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
