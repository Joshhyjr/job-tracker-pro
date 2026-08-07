import { useEffect, useMemo, useState } from "react";
import { getCompanyInitials, getCompanyLogoSource } from "@/lib/companyLogos";
import { cn } from "@/lib/utils";

type CompanyLogoSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<CompanyLogoSize, { frame: string; wordmarkFrame: string; image: string; wordmarkImage: string; text: string }> = {
  sm: { frame: "h-7 w-7", wordmarkFrame: "h-8 w-14 px-1", image: "h-5 w-5", wordmarkImage: "h-6 w-12", text: "text-[10px]" },
  md: { frame: "h-9 w-9", wordmarkFrame: "h-9 w-16 px-1", image: "h-6 w-6", wordmarkImage: "h-7 w-14", text: "text-xs" },
  lg: { frame: "h-12 w-12", wordmarkFrame: "h-12 w-20 px-1.5", image: "h-9 w-9", wordmarkImage: "h-9 w-16", text: "text-sm" },
};

export function CompanyLogo({
  companyName,
  jobLink,
  companyDomain,
  companyLogoUrl,
  size = "sm",
  className,
}: {
  companyName: string;
  jobLink?: string;
  companyDomain?: string;
  companyLogoUrl?: string;
  size?: CompanyLogoSize;
  className?: string;
}) {
  // A single service resolves every logo so the same company renders identically across the app.
  const logo = useMemo(
    () => getCompanyLogoSource(companyName, jobLink, { companyDomain, companyLogoUrl }),
    [companyName, jobLink, companyDomain, companyLogoUrl],
  );
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // A changed application should get a fresh image attempt instead of inheriting the prior row's failure.
    setFailed(false);
    setLoaded(false);
  }, [logo?.src]);

  const usesWordmark = logo?.presentation === "wordmark";
  const sizes = SIZE_CLASSES[size];
  const showImage = Boolean(logo) && !failed;

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white shadow-sm",
        usesWordmark ? sizes.wordmarkFrame : sizes.frame,
        className,
      )}
      data-testid="company-logo"
      data-logo-presentation={logo?.presentation ?? "fallback"}
    >
      {showImage ? (
        <>
          {/* Skeleton keeps table rows from flickering while remote favicons resolve. */}
          {!loaded && <span aria-hidden className="absolute inset-0 animate-pulse bg-slate-200" />}
          <img
            src={logo!.src}
            alt={`${companyName} logo`}
            // Wordmarks receive a wider frame while square marks keep the compact table rhythm.
            className={cn("relative object-contain", usesWordmark ? sizes.wordmarkImage : sizes.image, !loaded && "opacity-0")}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </>
      ) : (
        // Verified initials are the consistent fallback instead of a generic building icon.
        <span
          className={cn("font-bold text-slate-600", sizes.text)}
          aria-label={`${companyName} logo unavailable`}
        >
          {getCompanyInitials(companyName)}
        </span>
      )}
    </span>
  );
}
