import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, List, Bell, PlusCircle, Menu, X, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangeEvent, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "next-themes";

// Navigation link definitions
const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: List },
  { to: "/follow-ups", label: "Follow-ups", icon: Bell },
  { to: "/add", label: "Add New", icon: PlusCircle },
];

export default function AppNavbar({
  onExportCSV,
  onExportXLSX,
  onImportXLSX,
}: {
  onExportCSV: () => void;
  onExportXLSX: () => void;
  onImportXLSX: (file: File) => Promise<void>;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { theme = "system", setTheme } = useTheme();

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
        <Link to="/" className="text-lg font-bold tracking-tight">
          🎯 Job Tracker
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
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-[132px] h-9">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1" />Import XLSX</Button>
            <Button variant="outline" size="sm" onClick={onExportCSV}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={onExportXLSX}><Download className="h-3.5 w-3.5 mr-1" />XLSX</Button>
          </div>
        </div>

        {/* Mobile toggle */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile menu — also glass */}
      {open && (
        <div className="glass-subtle rounded-none border-x-0 border-b p-4 md:hidden">
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
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => importInputRef.current?.click()}>Import</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { onExportCSV(); setOpen(false); }}>CSV</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { onExportXLSX(); setOpen(false); }}>XLSX</Button>
            </div>
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
