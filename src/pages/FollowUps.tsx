import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Copy, Mail, Linkedin } from "lucide-react";
import type { JobApplication } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { isApplicationOverdue } from "@/lib/overdue";

function emailTemplate(a: JobApplication) {
  return `Subject: Following Up – ${a.jobTitle} Application

Dear Hiring Team,

I hope this message finds you well. I recently applied for the ${a.jobTitle} position at ${a.companyName} on ${a.dateApplied}, and I wanted to follow up to express my continued interest in this opportunity.

I believe my skills and experience align well with the role, and I would welcome the chance to discuss how I can contribute to your team. Please let me know if there are any updates regarding my application.

Thank you for your time and consideration.

Best regards`;
}

function linkedInTemplate(a: JobApplication) {
  return `Hi! I recently applied for the ${a.jobTitle} role at ${a.companyName} (${a.dateApplied}) and wanted to follow up. I'm very excited about this opportunity and would love to connect. Looking forward to hearing from you!`;
}

export default function FollowUps({ applications }: { applications: JobApplication[] }) {
  const { toast } = useToast();
  const now = new Date();

  const needsFollowUp = useMemo(() => {
    return applications.filter((a) => isApplicationOverdue(a, now));
  }, [applications, now]);

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} template copied to clipboard.` });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Follow-ups</h1>
        <p className="text-muted-foreground mt-1">{needsFollowUp.length} applications need follow-up</p>
      </div>

      {needsFollowUp.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">🎉 No pending follow-ups! You're all caught up.</CardContent></Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Title</TableHead>
                <TableHead className="hidden sm:table-cell">Company</TableHead>
                <TableHead>Date Applied</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needsFollowUp.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.jobTitle}</TableCell>
                  <TableCell className="hidden sm:table-cell">{a.companyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.dateApplied}</TableCell>
                  <TableCell><StatusBadge status={a.currentStatus} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => copyText(emailTemplate(a), "Email")}>
                        <Mail className="h-3.5 w-3.5 mr-1" />Email
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyText(linkedInTemplate(a), "LinkedIn")}>
                        <Linkedin className="h-3.5 w-3.5 mr-1" />LinkedIn
                      </Button>
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
