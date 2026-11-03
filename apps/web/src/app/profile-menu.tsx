import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuth, type User } from '../features/auth/use-auth';
import { avatarColor, initials } from '../shared/lib/avatar';

const ROLE_LABEL: Record<User['role'], string> = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente',
};

export function ProfileMenu({ user }: { user: User }) {
  const { logout } = useAuth();
  const role = ROLE_LABEL[user.role];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex h-11 items-center gap-2.5 rounded-full py-0 pr-2 pl-1 text-left outline-none hover:bg-[#f5f3f1] focus-visible:ring-4 focus-visible:ring-focus data-[state=open]:bg-[#f5f3f1]">
        <span
          aria-hidden="true"
          className="flex size-9 flex-none items-center justify-center rounded-full text-[13px] font-bold"
          style={{ backgroundColor: avatarColor(user.name) }}
        >
          {initials(user.name)}
        </span>
        <span className="hidden flex-col items-start leading-[1.2] sm:flex">
          <span className="text-[13.5px] font-semibold whitespace-nowrap">
            {user.name}
          </span>
          <span className="text-xs whitespace-nowrap text-muted">{role}</span>
        </span>
        <span className="sr-only sm:hidden">{user.name}</span>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-secondary"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-40 w-[260px] rounded-[18px] border border-line-strong bg-white p-1.5 shadow-[0_12px_32px_rgba(28,26,24,0.12)]"
        >
          <div className="mb-1.5 border-b border-line px-2.5 pt-2.5 pb-3">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-[12.5px] text-muted">{role}</div>
          </div>
          <DropdownMenu.Item
            onSelect={() => void logout()}
            className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-[13.5px] font-medium outline-none data-[highlighted]:bg-[#f5f3f1]"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
