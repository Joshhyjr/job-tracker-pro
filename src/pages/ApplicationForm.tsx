import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CURRENT_STATUSES, RESPONSE_STATUSES } from "@/lib/types";
import { addApplication, updateApplication } from "@/lib/storage";
import type { CurrentStatus, JobApplication } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  jobTitle: z.string().trim().min(1, "Required").max(200),
  companyName: z.string().trim().min(1, "Required").max(200),
  location: z.string().trim().max(200),
  currentStatus: z.enum(CURRENT_STATUSES as [CurrentStatus, ...CurrentStatus[]]),
  responseStatus: z.string().trim().min(1, "Required").max(200),
  followUps: z.boolean(),
  dateApplied: z.string().min(1, "Required"),
  notes: z.string().trim().max(2000).optional(),
  followUpDate: z.string().max(10).optional(),
});

type FormData = z.infer<typeof schema>;

// Keep form defaults in a helper so create and edit modes stay easy to compare.
function getDefaultValues(existing?: JobApplication): FormData {
  if (existing) {
    return {
      jobTitle: existing.jobTitle,
      companyName: existing.companyName,
      location: existing.location,
      currentStatus: existing.currentStatus,
      responseStatus: existing.responseStatus,
      followUps: existing.followUps,
      dateApplied: existing.dateApplied,
      notes: existing.notes,
      followUpDate: existing.followUpDate,
    };
  }

  return {
    jobTitle: "",
    companyName: "",
    location: "",
    currentStatus: "Applied",
    responseStatus: "No Response",
    followUps: false,
    dateApplied: new Date().toISOString().split("T")[0],
    notes: "",
    followUpDate: "",
  };
}

export default function ApplicationForm({ existing, onSaved }: { existing?: JobApplication; onSaved: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(existing),
  });

  function onSubmit(data: FormData) {
    // Storage performs the final sanitisation pass; future AI/API calls must stay server-side with private keys off the Vite client.
    const applicationInput: Omit<JobApplication, "id" | "activityLog"> = {
      jobTitle: data.jobTitle,
      companyName: data.companyName,
      location: data.location,
      currentStatus: data.currentStatus,
      responseStatus: data.responseStatus,
      followUps: data.followUps,
      dateApplied: data.dateApplied,
      notes: data.notes ?? "",
      followUpDate: data.followUpDate ?? "",
    };

    if (existing) {
      updateApplication({ ...existing, ...applicationInput });
      toast({ title: "Updated", description: "Application updated." });
    } else {
      addApplication(applicationInput);
      toast({ title: "Added", description: "New application added." });
    }
    onSaved();
    navigate("/app/applications");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{existing ? "Edit" : "Add"} Application</h1>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="jobTitle" render={({ field }) => (
                  <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dateApplied" render={({ field }) => (
                  <FormItem><FormLabel>Date Applied</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="currentStatus" render={({ field }) => (
                  <FormItem><FormLabel>Current Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{CURRENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="responseStatus" render={({ field }) => (
                  <FormItem><FormLabel>Response Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{RESPONSE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="followUpDate" render={({ field }) => (
                  <FormItem><FormLabel>Follow-Up Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="submit">{existing ? "Save Changes" : "Add Application"}</Button>
                <Button type="button" variant="outline" onClick={() => navigate("/app/applications")}>Cancel</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
