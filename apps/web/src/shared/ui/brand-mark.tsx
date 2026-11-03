type BrandMarkProps = { showWordmark?: boolean };

/** The "h!" tile, on the orange brand panel, with the optional wordmark. */
export function BrandMark({ showWordmark = true }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-[20px] bg-white font-display text-[22px] font-bold tracking-[-0.04em] text-brand"
      >
        h!
      </div>
      {showWordmark ? (
        <span className="font-display text-[28px] font-bold tracking-[-0.02em] text-white">
          Helpy
        </span>
      ) : null}
    </div>
  );
}
