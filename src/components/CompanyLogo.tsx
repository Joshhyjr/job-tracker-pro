import { useMemo, useState, type ReactNode } from "react";
import {
  cacheFailedCompanyLogo,
  cacheSuccessfulCompanyLogo,
  getCompanyFallbackStyle,
  getCompanyInitials,
  getCompanyLogoCandidates,
  resolveCompanyDomain,
  type CompanyLogoSource,
} from "@/lib/companyLogos";
import { cn } from "@/lib/utils";

type CompanyLogoSize = "sm" | "md" | "lg" | number;
type CompanyLogoRounding = boolean | "none" | "sm" | "md" | "lg" | "full";

export interface CompanyLogoProps {
  /** `company` remains a concise alias for callers using <CompanyLogo company="Google" />. */
  company?: string;
  companyName?: string;
  companyId?: string;
  jobLink?: string;
  companyDomain?: string;
  logoUrl?: string;
  /** Backwards-compatible application field alias. */
  companyLogoUrl?: string;
  size?: CompanyLogoSize;
  rounded?: CompanyLogoRounding;
  fallback?: ReactNode | false;
  className?: string;
}

const SIZE_CLASSES = {
  sm: { frame: "h-7 w-7", wordmarkFrame: "h-8 w-14 px-1", image: "h-5 w-5", wordmarkImage: "h-6 w-12", text: "text-[10px]" },
  md: { frame: "h-9 w-9", wordmarkFrame: "h-9 w-16 px-1", image: "h-6 w-6", wordmarkImage: "h-7 w-14", text: "text-xs" },
  lg: { frame: "h-12 w-12", wordmarkFrame: "h-12 w-20 px-1.5", image: "h-9 w-9", wordmarkImage: "h-9 w-16", text: "text-sm" },
} as const;

const ROUNDING_CLASSES: Record<Exclude<CompanyLogoRounding, boolean>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

function retryUrl(src: string, attempt: number): string {
  if (attempt === 0 || src.startsWith("data:") || src.startsWith("blob:")) return src;
  try {
    const url = new URL(src, window.location.origin);
    // A distinct query bypasses cached transient failures while preserving every provider parameter.
    url.searchParams.set("logo_retry", String(attempt));
    return src.startsWith("/") ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return src;
  }
}

function CompanyLogoImage({
  companyName,
  companyDomain,
  sources,
  size,
  rounded,
  fallback,
  className,
}: {
  companyName: string;
  companyDomain?: string;
  sources: CompanyLogoSource[];
  size: CompanyLogoSize;
  rounded: CompanyLogoRounding;
  fallback?: ReactNode | false;
  className?: string;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const source = sources[sourceIndex];
  const usesWordmark = source?.presentation === "wordmark";
  const namedSize = typeof size === "number" ? null : SIZE_CLASSES[size];
  const numericFrameStyle = typeof size === "number"
    ? { width: usesWordmark ? Math.round(size * 1.65) : size, height: size }
    : undefined;
  const numericImageStyle = typeof size === "number"
    ? { width: usesWordmark ? Math.round(size * 1.4) : Math.round(size * 0.72), height: Math.round(size * 0.72) }
    : undefined;
  const roundingClass = rounded === true
    ? "rounded-full"
    : rounded === false
      ? "rounded-none"
      : ROUNDING_CLASSES[rounded];
  const showImage = Boolean(source);

  function handleImageError() {
    if (!source) return;
    if (attempt === 0) {
      // Retry each trusted source exactly once before advancing through the provider chain.
      setLoaded(false);
      setAttempt(1);
      return;
    }
    cacheFailedCompanyLogo(companyName, source);
    setLoaded(false);
    setAttempt(0);
    setSourceIndex((current) => current + 1);
  }

  function handleImageLoad() {
    if (!source) return;
    setLoaded(true);
    cacheSuccessfulCompanyLogo(companyName, source, resolveCompanyDomain(companyName, undefined, companyDomain));
  }

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border shadow-sm",
        showImage ? "bg-white" : "rounded-full border-transparent",
        showImage ? roundingClass : "rounded-full",
        namedSize && (usesWordmark ? namedSize.wordmarkFrame : namedSize.frame),
        className,
      )}
      style={!showImage ? { ...numericFrameStyle, ...getCompanyFallbackStyle(companyName) } : numericFrameStyle}
      data-testid="company-logo"
      data-logo-presentation={source?.presentation ?? "fallback"}
      data-logo-provider={source?.provider ?? "fallback"}
    >
      {showImage ? (
        <>
          {/* The fixed frame and in-place skeleton prevent table and card layout shifts. */}
          {!loaded ? <span aria-hidden className="absolute inset-0 animate-pulse bg-slate-200" /> : null}
          <img
            src={retryUrl(source.src, attempt)}
            alt={`${companyName} logo`}
            width={typeof size === "number" ? numericImageStyle?.width : undefined}
            height={typeof size === "number" ? numericImageStyle?.height : undefined}
            className={cn(
              "relative object-contain transition-opacity",
              namedSize && (usesWordmark ? namedSize.wordmarkImage : namedSize.image),
              !loaded && "opacity-0",
            )}
            style={numericImageStyle}
            loading="lazy"
            decoding="async"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </>
      ) : (
        <span
          className={cn("font-bold", namedSize?.text)}
          role="img"
          aria-label={`${companyName} logo`}
        >
          {/* A custom fallback can replace the default initials without changing the frame contract. */}
          {fallback === false ? null : fallback ?? getCompanyInitials(companyName)}
        </span>
      )}
    </span>
  );
}

export function CompanyLogo({
  company,
  companyName: companyNameProp,
  companyId,
  jobLink,
  companyDomain,
  logoUrl,
  companyLogoUrl,
  size = "sm",
  rounded = "md",
  fallback,
  className,
}: CompanyLogoProps) {
  const companyName = (companyNameProp ?? company ?? "Unknown company").trim() || "Unknown company";
  // Memoize source lookup because it reads the versioned browser directory and builds the same URLs for every render.
  const sources = useMemo(
    () => getCompanyLogoCandidates(companyName, jobLink, { companyId, companyDomain, companyLogoUrl: logoUrl ?? companyLogoUrl }),
    [companyId, companyName, jobLink, companyDomain, logoUrl, companyLogoUrl],
  );
  const sourceKey = sources.map((source) => source.src).join("|");

  return (
    <CompanyLogoImage
      // Keyed state resets retries only when the resolved company/source chain actually changes.
      key={`${companyName}|${sourceKey}`}
      companyName={companyName}
      companyDomain={companyDomain}
      sources={sources}
      size={size}
      rounded={rounded}
      fallback={fallback}
      className={className}
    />
  );
}
