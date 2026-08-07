type BrandLogoProps = {
  showText?: boolean;
  className?: string;
};

export function BrandLogo({ showText = true, className = "" }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Job Tracker">
      {/* Use the exported monogram asset so the navbar, favicon, and share assets stay visually aligned. */}
      <img src="/brand-mark.svg" alt="" aria-hidden="true" className="h-8 w-8 shrink-0 rounded-md bg-white/95 p-0.5" />
      {showText && (
        <span className="leading-none">
          {/* Display the simplified product name beside the shared JK monogram. */}
          <span className="block whitespace-nowrap text-sm font-extrabold tracking-wide text-current">JOB TRACKER</span>
        </span>
      )}
    </span>
  );
}
