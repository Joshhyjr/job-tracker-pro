type BrandLogoProps = {
  showText?: boolean;
  className?: string;
};

export function BrandLogo({ showText = true, className = "" }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Job Tracker Pro">
      {/* Brand mark mirrors the briefcase and growth-arrow identity used for the site logo. */}
      <svg className="h-9 w-9 shrink-0" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="brand-briefcase" x1="14" y1="16" x2="45" y2="49" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0f4c81" />
            <stop offset="1" stopColor="#0b2742" />
          </linearGradient>
          <linearGradient id="brand-growth" x1="25" y1="47" x2="53" y2="13" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b8aa" />
            <stop offset="1" stopColor="#0f375f" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="#eef8f7" />
        <path d="M22 20h20a7 7 0 0 1 7 7v20a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5V27a7 7 0 0 1 7-7Z" fill="url(#brand-briefcase)" />
        <path d="M24 20v-3.5A6.5 6.5 0 0 1 30.5 10h8A6.5 6.5 0 0 1 45 16.5V20h-5v-3.5A1.5 1.5 0 0 0 38.5 15h-8a1.5 1.5 0 0 0-1.5 1.5V20h-5Z" fill="#114d76" />
        <path d="M15 31h35" stroke="#94d8e4" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
        <path d="M26 47 36 35l7 7 13-23" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M26 47 36 35l7 7 13-23" fill="none" stroke="url(#brand-growth)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M48 17h10v10" fill="none" stroke="#0f375f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showText && (
        <span className="leading-none">
          <span className="block text-base font-extrabold tracking-wide text-foreground">JOB TRACKER</span>
          <span className="block text-sm font-extrabold tracking-wide text-teal-500">PRO</span>
        </span>
      )}
    </span>
  );
}
