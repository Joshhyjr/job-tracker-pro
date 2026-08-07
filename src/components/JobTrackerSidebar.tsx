import { ChangeEvent, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  BellRing,
  ChevronDown,
  Download,
  FileText,
  FileSpreadsheet,
  Globe2,
  LayoutDashboard,
  ListChecks,
  Plus,
  Settings,
} from "lucide-react";
import avatar from "@/assets/joshua-avatar.png";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/applications", label: "Applications", icon: ListChecks },
  { to: "/app/follow-ups", label: "Follow-ups", icon: BellRing },
  { to: "/app/analytics", label: "AI & Analytics", icon: BarChart3 },
  { to: "/app/locations", label: "Locations", icon: Globe2 },
  { to: "/app/documents", label: "Documents", icon: FileText },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export interface JobTrackerSidebarProps {
  onExportCSV: () => void;
  onExportXLSX: () => void;
  onImportXLSX: (file: File) => Promise<void>;
}

export default function JobTrackerSidebar({ onExportCSV, onExportXLSX, onImportXLSX }: JobTrackerSidebarProps) {
  const location = useLocation();
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // Sidebar imports use the same validated shell callback as every other import entry point.
    await onImportXLSX(file);
    event.target.value = "";
  }

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-card lg:block" aria-label="Job Tracker sidebar">
      <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col overflow-y-auto px-3 py-5">
        {/* The profile stays deliberately compact so the app never becomes a portfolio page. */}
        <div className="border-b px-2 pb-5">
          <div className="flex items-center gap-3">
            <img src={avatar} alt="Joshua Kivaria" className="h-12 w-12 rounded-lg border bg-muted object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Joshua Kivaria</p>
              <p className="text-[11px] text-muted-foreground">Halifax, Nova Scotia</p>
              <Link to="/" className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline">Back to JK.space</Link>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Your job search, organized.</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="mt-3 w-full justify-between text-xs" aria-label="Open quick actions">
                Quick Actions <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-56">
              <DropdownMenuItem asChild><Link to="/app/add"><Plus className="mr-2 h-4 w-4" />Add application</Link></DropdownMenuItem>
              <DropdownMenuItem onClick={() => importInputRef.current?.click()}><FileSpreadsheet className="mr-2 h-4 w-4" />Import XLSX</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={onExportXLSX}><Download className="mr-2 h-4 w-4" />Export XLSX</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/app/analytics"><BarChart3 className="mr-2 h-4 w-4" />AI &amp; Analytics</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            aria-label="Choose an XLSX workbook from the sidebar"
            onChange={handleImportChange}
          />
        </div>

        <p className="px-2 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">My workspace</p>
        <nav className="space-y-1">
          {primaryLinks.map((item) => {
            const active = item.to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t pt-4">
          <Link to="/app/add" className="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5">
            <Plus className="h-4 w-4" />Add new application
          </Link>
        </div>
      </div>
    </aside>
  );
}
