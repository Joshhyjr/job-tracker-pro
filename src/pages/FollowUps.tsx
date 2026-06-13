import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Mail, Linkedin } from "lucide-react";
import type { JobApplication } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { isApplicationOverdue } from "@/lib/overdue";
import { formatDisplayDate } from "@/lib/utils";

const followUpActions = [
  { label: "Email", icon: Mail, buildMessage: emailTemplate },
  { label: "LinkedIn", icon: Linkedin, buildMessage: linkedInTemplate },
] as const;

function emailTemplate(a: JobApplication) {
  return `Subject: Following Up – ${a.jobTitle} Application

Dear Hiring Team,

I hope this message finds you well. I recently applied for the ${a.jobTitle} position at ${a.companyName} on ${formatDisplayDate(a.dateApplied)}, and I wanted to follow up to express my continued interest in this opportunity.

I believe my skills and experience align well with the role, and I would welcome the chance to discuss how I can contribute to your team. Please let me know if there are any updates regarding my application.

Thank you for your time and consideration.

Best regards`;
}

function linkedInTemplate(a: JobApplication) {
  return `Hi! I recently applied for the ${a.jobTitle} role at ${a.companyName} (${formatDisplayDate(a.dateApplied)}) and wanted to follow up. I'm very excited about this opportunity and would love to connect. Looking forward to hearing from you!`;
}

export default function FollowUps({ applications }: { applications: JobApplication[] }) {
  const { toast } = useToast();

  const needsFollowUp = useMemo(() => {
    // Capture the current time when application data changes instead of invalidating memoization every render.
    const now = new Date();
    return applications.filter((a) => isApplicationOverdue(a, now));
  }, [applications]);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `${label} template copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: `Unable to copy the ${label} template.`, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Follow-ups</h1>
        <p className="text-muted-foreground mt-1">{needsFollowUp.length} applications need follow-up</p>
      </div>

      {needsFollowUp.length === 0 ? (
        <Card className="border-border/40 shadow-none"><CardContent className="py-12 text-center text-muted-foreground">🎉 No pending follow-ups! You're all caught up.</CardContent></Card>
      ) : (
        <div className="rounded-2xl border border-border/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40">
                <TableHead>Job Title</TableHead>
                <TableHead className="hidden sm:table-cell">Company</TableHead>
                <TableHead>Date Applied</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needsFollowUp.map((a) => (
                <TableRow key={a.id} className="border-border/30">
                  <TableCell className="font-medium">{a.jobTitle}</TableCell>
                  <TableCell className="hidden sm:table-cell">{a.companyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDisplayDate(a.dateApplied)}</TableCell>
                  <TableCell><StatusBadge status={a.currentStatus} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {followUpActions.map((action) => (
                        // Keep follow-up actions declarative so new contact channels can be added without duplicating button markup.
                        <Button key={action.label} type="button" variant="outline" size="sm" onClick={() => copyText(action.buildMessage(a), action.label)}>
                          <action.icon className="h-3.5 w-3.5 mr-1" />{action.label}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
