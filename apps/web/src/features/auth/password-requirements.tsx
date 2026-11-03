import { passwordRules } from './signup-schema';

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4.5 gap-y-2 p-0">
      {passwordRules(password).map(({ label, ok }) => (
        <li
          key={label}
          data-ok={ok}
          className={`flex items-center gap-1.5 text-[13px] ${ok ? 'text-[#23774a]' : 'text-muted'}`}
        >
          <span
            aria-hidden="true"
            className={`flex size-4 items-center justify-center rounded-full text-white ${ok ? 'bg-[#23774a]' : 'bg-[#ddd8d3]'}`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12 5 5 9-10" />
            </svg>
          </span>
          {label}
          <span className="sr-only">{ok ? ' (atendido)' : ' (pendente)'}</span>
        </li>
      ))}
    </ul>
  );
}
