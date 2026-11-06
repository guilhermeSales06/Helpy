import { avatarColor, initials } from '../../shared/lib/avatar';

/** Decorative: the name always sits next to it. */
export function PersonAvatar({
  name,
  className,
}: {
  name: string;
  /** Size and type, e.g. `size-[42px] text-sm`. */
  className: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full font-bold ${className}`}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}
