import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, List, Bell, PlusCircle, Menu, X, Download, Upload, Globe2, LogOut, Cloud, CloudOff, HardDrive, LogIn, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangeEvent, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "next-themes";
import { BrandLogo } from "@/components/BrandLogo";
import type { User } from "firebase/auth";

// Navigation link definitions — Job Tracker lives under /app/* now (portfolio is at /).
const links = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/applications", label: "Applications", icon: List },
  { to: "/app/locations", label: "Locations", icon: Globe2 },
  { to: "/app/follow-ups", label: "Follow-ups", icon: Bell },
  { to: "/app/add", label: "Add New", icon: PlusCircle },
];

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
}: {
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
}) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { theme = "system", setTheme } = useTheme();

  function handleImportClick() {
    importInputRef.current?.click();
  }

  function handleExportCSV() {
    onExportCSV();
    setOpen(false);
  }

  function handleExportXLSX() {
    onExportXLSX();
    setOpen(false);
  }

  // Keep theme selection markup in one place so desktop and mobile stay aligned.
  function renderThemeSelect(triggerClassName: string) {
    return (
      <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  async function handleImportChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await onImportXLSX(file);
    e.target.value = "";
    setOpen(false);
  }

  return (
    /* Glass navbar — translucent + backdrop-blur */
    <nav className="sticky top-0 z-50 glass rounded-none border-x-0 border-t-0">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo />
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Button key={l.to} variant={location.pathname === l.to ? "secondary" : "ghost"} size="sm" asChild>
              <Link to={l.to} className="gap-1.5">
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            </Button>
          ))}
          <div className="ml-2 flex gap-1">
            {renderThemeSelect("h-9 w-[132px]")}
            {mode === "owner" && <Button variant="outline" size="sm" onClick={handleImportClick}><Upload className="h-3.5 w-3.5 mr-1" />Import XLSX</Button>}
            <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={handleExportXLSX}><Download className="h-3.5 w-3.5 mr-1" />XLSX</Button>
            {mode === "owner" ? (
              <>
                <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground" title={user?.email || "Signed in"}>
                  {offline ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
                  {syncing ? "Syncing" : offline ? "Offline" : "Synced"}
                </div>
                <Button variant="ghost" size="icon" onClick={() => void onSignOut?.()} aria-label={`Sign out ${user?.email || "account"}`}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                {/* Demo controls make the public/local boundary explicit without hiding the working product. */}
                <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground" title="Sample data saved only in this browser">
                  <HardDrive className="h-3.5 w-3.5" />Demo mode
                </div>
                <Button variant="ghost" size="sm" onClick={() => void onResetDemo?.()}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</Button>
                <Button size="sm" onClick={() => void onSignIn?.()}><LogIn className="mr-1 h-3.5 w-3.5" />Log in with Google</Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile menu — also glass */}
      {open && (
        <div id="mobile-navigation" className="glass-subtle rounded-none border-x-0 border-b p-4 md:hidden">
          <div className="flex flex-col gap-2">
            {links.map((l) => (
              <Button key={l.to} variant={location.pathname === l.to ? "secondary" : "ghost"} asChild className="justify-start" onClick={() => setOpen(false)}>
                <Link to={l.to} className="gap-2">
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              </Button>
            ))}
            <div className="flex gap-2 pt-2 border-t border-border/40">
              {renderThemeSelect("h-9 flex-1")}
              {mode === "owner" && <Button variant="outline" size="sm" className="flex-1" onClick={handleImportClick}>Import</Button>}
              <Button variant="outline" size="sm" className="flex-1" onClick={handleExportCSV}>CSV</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleExportXLSX}>XLSX</Button>
            </div>
            {mode === "owner" ? (
              /* Mobile account controls expose both identity and cloud status without crowding the primary links. */
              <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
                <span className="truncate">{user?.email}</span>
                <span>{syncing ? "Syncing" : offline ? "Offline" : "Synced"}</span>
                <Button variant="ghost" size="sm" onClick={() => void onSignOut?.()}><LogOut className="mr-1 h-3.5 w-3.5" />Sign out</Button>
              </div>
            ) : (
              <div className="space-y-2 border-t border-border/40 pt-3">
                {/* Public visitors stay in the local sandbox unless the allowlisted owner signs in. */}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><HardDrive className="h-3.5 w-3.5" />Demo data stays in this browser</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => void onResetDemo?.()}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset demo</Button>
                  <Button size="sm" className="flex-1" onClick={() => void onSignIn?.()}><LogIn className="mr-1 h-3.5 w-3.5" />Log in</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Hidden file input for XLSX import */}
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImportChange}
      />
    </nav>
  );
}
