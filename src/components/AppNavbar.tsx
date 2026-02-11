import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, List, Bell, PlusCircle, Menu, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: List },
  { to: "/follow-ups", label: "Follow-ups", icon: Bell },
  { to: "/add", label: "Add New", icon: PlusCircle },
];

export default function AppNavbar({ onExportCSV, onExportXLSX }: { onExportCSV: () => void; onExportXLSX: () => void }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight">
          🎯 Job Tracker
        </Link>

        {/* Desktop */}
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
            <Button variant="outline" size="sm" onClick={onExportCSV}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={onExportXLSX}><Download className="h-3.5 w-3.5 mr-1" />XLSX</Button>
          </div>
        </div>

        {/* Mobile toggle */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t bg-card p-4 md:hidden">
          <div className="flex flex-col gap-2">
            {links.map((l) => (
              <Button key={l.to} variant={location.pathname === l.to ? "secondary" : "ghost"} asChild className="justify-start" onClick={() => setOpen(false)}>
                <Link to={l.to} className="gap-2">
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              </Button>
            ))}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { onExportCSV(); setOpen(false); }}>CSV</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { onExportXLSX(); setOpen(false); }}>XLSX</Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
