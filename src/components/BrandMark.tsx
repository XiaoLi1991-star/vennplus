export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
    >
      <circle cx="13" cy="13" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="23" cy="13" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="22" r="8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
