import { ChangeEvent, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  ExternalLink,
  LogIn,
  LogOut,
  Menu,
  Moon,
  RotateCcw,
  Search,
  Sun,
  Upload,
  X,
} from "lucide-react";
import type { User } from "firebase/auth";
import { useTheme } from "next-themes";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface AppNavbarProps {
  onExportCSV: () => void;
  onExportXLSX: () => void;
  onImportXLSX: (file: File) => Promise<void>;
  user?: User;
  syncing: boolean;
  offline: boolean;
  onSignOut?: () => Promise<void>;
  mode: "demo" | "owner";
  onSignIn?: () => Promise<void>;
  onResetDemo?: () => Promise<void>;
}

export default function AppNavbar({
  onExportCSV,
  onExportXLSX,
  onImportXLSX,
  user,
  syncing,
  offline,
  onSignOut,
  mode,
  onSignIn,
  onResetDemo,
}: AppNavbarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // The shared shell remains the only parser and persistence boundary for workbook imports.
    await onImportXLSX(file);
    event.target.value = "";
  }

  const themeLabel = resolvedTheme === "dark" ? "Use light theme" : "Use dark theme";

  return (
    <header className="job-topbar sticky top-0 z-40 border-b border-white/15 text-primary-foreground shadow-sm">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Link to="/app" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Job Tracker">
          <BrandLogo className="job-brand" />
        </Link>

        {/* Desktop search mirrors the compact social-network utility bar in the reference. */}
        <label className="relative ml-2 hidden w-full max-w-sm lg:block">
          <span className="sr-only">Search applications</span>
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            placeholder="Search your job tracker"
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.currentTarget.value.trim()) {
                window.location.assign(`/app/applications?q=${encodeURIComponent(event.currentTarget.value.trim())}`);
              }
            }}
            className="h-8 w-full rounded-md border-0 bg-white/95 pl-9 pr-3 text-xs text-slate-900 outline-none ring-offset-primary placeholder:text-slate-500 focus:ring-2 focus:ring-white"
          />
        </label>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Job Tracker utilities">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" asChild>
            <Link to="/" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" />JK.space</Link>
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10 hover:text-white" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
            aria-label={themeLabel}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-white hover:bg-white/10 hover:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold">JK</span>
                <span className="hidden xl:inline">{mode === "owner" ? "Joshua" : "Demo mode"}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{mode === "owner" ? user?.email : "Public demo workspace"}</p>
                <p className="mt-1 flex items-center gap-1.5">
                  {mode === "owner" ? (offline ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />) : null}
                  {mode === "owner" ? (syncing ? "Syncing" : offline ? "Offline" : "Synced") : "Saved in this browser"}
                </p>
              </div>
              <DropdownMenuSeparator />
              {mode === "owner" && <DropdownMenuItem onClick={() => importInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Import XLSX</DropdownMenuItem>}
              <DropdownMenuItem onClick={onExportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={onExportXLSX}><Download className="mr-2 h-4 w-4" />Export XLSX</DropdownMenuItem>
              <DropdownMenuSeparator />
              {mode === "owner" ? (
                <DropdownMenuItem onClick={() => void onSignOut?.()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => void onResetDemo?.()}><RotateCcw className="mr-2 h-4 w-4" />Reset demo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onSignIn?.()}><LogIn className="mr-2 h-4 w-4" />Log in with Google</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto text-white hover:bg-white/10 hover:text-white md:hidden"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((current) => !current)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation" className="border-t border-white/15 bg-primary px-4 py-3 md:hidden">
          <div className="grid gap-1 text-sm">
            <Link to="/" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-white/10">Back to JK.space</Link>
            <Link to="/app/applications" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-white/10">Applications</Link>
            <Link to="/app/follow-ups" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-white/10">Follow-ups</Link>
            <Link to="/app/analytics" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-white/10">AI &amp; Analytics</Link>
            <button type="button" className="rounded-md px-3 py-2 text-left hover:bg-white/10" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{themeLabel}</button>
          </div>
        </div>
      )}

      <input
        ref={importInputRef}
        id="job-tracker-import-input"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        aria-label="Choose an XLSX workbook from the navbar"
        onChange={handleImportChange}
      />
      {/* Route data helps visual tests confirm the top bar remains scoped to the app. */}
      <span className="sr-only" aria-live="polite">Current Job Tracker route: {location.pathname}</span>
    </header>
  );
}
