import { useId, type ComponentProps } from 'react';
import { errorClass, inputClass, labelClass } from './field-styles';

export type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: string;
  error?: string;
};

export function TextField({
  label,
  error,
  className = '',
  ...props
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${inputClass} ${className}`}
        {...props}
      />
      {error ? (
        <span id={errorId} className={errorClass}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
