import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { cn } from "@/lib/utils";

export function CompanyLogo({ companyName, jobLink }: { companyName: string; jobLink?: string }) {
  const logo = useMemo(() => getCompanyLogoSource(companyName, jobLink), [companyName, jobLink]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // A changed application should get a fresh image attempt instead of inheriting the prior row's failure.
    setFailed(false);
  }, [logo?.src]);

  const usesWordmark = logo?.presentation === "wordmark";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white shadow-sm",
        usesWordmark ? "h-8 w-14 px-1" : "h-7 w-7",
      )}
      data-testid="company-logo"
      data-logo-presentation={logo?.presentation ?? "fallback"}
    >
      {logo && !failed ? (
        <img
          src={logo.src}
          alt={`${companyName} logo`}
          // Wordmarks receive a wider frame while square marks keep the compact table rhythm.
          className={cn("object-contain", usesWordmark ? "h-6 w-12" : "h-5 w-5")}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Building2 className="h-3.5 w-3.5 text-slate-500" aria-label={`${companyName} logo unavailable`} />
      )}
    </span>
  );
}
