import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_PORTFOLIO_LIST_ITEMS,
  MAX_PORTFOLIO_PROJECTS,
  normalizeItemOrder,
  normalizePortfolioContent,
  portfolioPageContentSchema,
  resolvePortfolioContent,
  type PortfolioPageContent,
  type PortfolioProject,
} from "@/lib/portfolioContent";

export type PortfolioEditSection = "profile" | "about" | "activity" | "projects" | "skills" | "certifications";

interface PortfolioEditorProps {
  open: boolean;
  content: PortfolioPageContent;
  initialSection: PortfolioEditSection;
  usingFallback: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (content: PortfolioPageContent) => Promise<void>;
}

function createId(prefix: string): string {
  // Random stable IDs keep Firestore document identity independent from editable labels.
  return `${prefix}-${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
}

function cloneContent(content: PortfolioPageContent): PortfolioPageContent {
  // Portfolio content is JSON-safe, so cloning prevents abandoned dialog edits from leaking into the page.
  return JSON.parse(JSON.stringify(content));
}

function moveItem<T extends { order: number }>(items: T[], index: number, direction: -1 | 1): T[] {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const reordered = [...items];
  [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
  return normalizeItemOrder(reordered);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>;
}

function OrderControls({
  label,
  index,
  total,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" aria-label={`Move ${label} down`} disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" aria-label={`Remove ${label}`} disabled={total === 1} onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function createProject(projectCount: number): PortfolioProject {
  return {
    id: createId("project"),
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 7),
    links: [{ label: "", href: "" }],
    order: projectCount,
  };
}

export function PortfolioEditor({ open, content, initialSection, usingFallback, onOpenChange, onSave }: PortfolioEditorProps) {
  const [draft, setDraft] = useState<PortfolioPageContent>(() => cloneContent(content));
  const [section, setSection] = useState<PortfolioEditSection>(initialSection);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Render a complete draft while Fast Refresh replaces any state kept from the previous module shape.
  const safeDraft = resolvePortfolioContent(draft);

  useEffect(() => {
    if (safeDraft === draft) return;
    // Healing the preserved state also keeps later editor updates away from undefined collections.
    setDraft(safeDraft);
  }, [draft, safeDraft]);

  useEffect(() => {
    if (!open) return;
    // Each opening starts from the latest public version and the section clicked on the page.
    setDraft(cloneContent(content));
    setSection(initialSection);
    setError("");
  }, [content, initialSection, open]);

  function updateProfile(updates: Partial<PortfolioPageContent["profile"]>) {
    setDraft((current) => ({ ...current, profile: { ...current.profile, ...updates } }));
  }

  function updateProject(index: number, updates: Partial<PortfolioProject>) {
    setDraft((current) => ({
      ...current,
      projects: current.projects.map((project, projectIndex) => projectIndex === index ? { ...project, ...updates } : project),
    }));
  }

  function updateProjectLink(projectIndex: number, linkIndex: number, field: "label" | "href", value: string) {
    setDraft((current) => ({
      ...current,
      projects: current.projects.map((project, currentProjectIndex) => currentProjectIndex !== projectIndex ? project : {
        ...project,
        links: project.links.map((link, currentLinkIndex) => currentLinkIndex === linkIndex ? { ...link, [field]: value } : link),
      }),
    }));
  }

  async function handleSave() {
    const validated = portfolioPageContentSchema.safeParse(normalizePortfolioContent(safeDraft));
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Review the portfolio fields and retry.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(validated.data);
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The portfolio could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit portfolio page</DialogTitle>
          <DialogDescription>
            Edit public copy, links, lists, and ordering. Images, layout, navigation, and contact handling remain protected.
            {usingFallback ? " The editor is currently showing the checked-in fallback content." : " You are editing the public Firestore content."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={section} onValueChange={(value) => setSection(value as PortfolioEditSection)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="certifications">Certificates</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><Input value={safeDraft.profile.name} maxLength={80} onChange={(event) => updateProfile({ name: event.target.value })} /></Field>
              <Field label="Location"><Input value={safeDraft.profile.location} maxLength={120} onChange={(event) => updateProfile({ location: event.target.value })} /></Field>
            </div>
            <Field label="Professional headline"><Input value={safeDraft.profile.headline} maxLength={160} onChange={(event) => updateProfile({ headline: event.target.value })} /></Field>
            <Field label="Profile quote"><Textarea value={safeDraft.profile.quote} maxLength={240} onChange={(event) => updateProfile({ quote: event.target.value })} /></Field>
            <Field label="Status prompt"><Input value={safeDraft.profile.statusPrompt} maxLength={120} onChange={(event) => updateProfile({ statusPrompt: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="LinkedIn URL"><Input type="url" value={safeDraft.profile.linkedinHref} maxLength={2048} onChange={(event) => updateProfile({ linkedinHref: event.target.value })} /></Field>
              <Field label="GitHub URL"><Input type="url" value={safeDraft.profile.githubHref} maxLength={2048} onChange={(event) => updateProfile({ githubHref: event.target.value })} /></Field>
            </div>
          </TabsContent>

          <TabsContent value="about" className="space-y-4">
            <Field label="About me"><Textarea rows={6} value={safeDraft.profile.about} maxLength={1000} onChange={(event) => updateProfile({ about: event.target.value })} /></Field>
            <Field label="Greeting"><Input value={safeDraft.profile.greeting} maxLength={80} onChange={(event) => updateProfile({ greeting: event.target.value })} /></Field>
            <Field label="Introduction"><Textarea value={safeDraft.profile.introduction} maxLength={600} onChange={(event) => updateProfile({ introduction: event.target.value })} /></Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Outside the terminal</legend>
              {safeDraft.interests.map((interest, index) => (
                <div key={interest.id} className="flex gap-2">
                  <Input aria-label={`Interest ${index + 1}`} value={interest.text} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, interests: current.interests.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) }))} />
                  <OrderControls label={interest.text || `interest ${index + 1}`} index={index} total={safeDraft.interests.length} onMove={(direction) => setDraft((current) => ({ ...current, interests: moveItem(current.interests, index, direction) }))} onRemove={() => setDraft((current) => ({ ...current, interests: normalizeItemOrder(current.interests.filter((_, itemIndex) => itemIndex !== index)) }))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={safeDraft.interests.length >= MAX_PORTFOLIO_LIST_ITEMS} onClick={() => setDraft((current) => ({ ...current, interests: [...current.interests, { id: createId("interest"), text: "", order: current.interests.length }] }))}><Plus className="mr-1 h-4 w-4" /> Add interest</Button>
            </fieldset>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Recent activity</legend>
              {safeDraft.activities.map((activity, index) => (
                <section key={activity.id} className="space-y-2 rounded-md border p-3" aria-label={`Activity ${index + 1}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Activity {index + 1}</span><OrderControls label={`activity ${index + 1}`} index={index} total={safeDraft.activities.length} onMove={(direction) => setDraft((current) => ({ ...current, activities: moveItem(current.activities, index, direction) }))} onRemove={() => setDraft((current) => ({ ...current, activities: normalizeItemOrder(current.activities.filter((_, itemIndex) => itemIndex !== index)) }))} /></div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["prefix", "highlight", "suffix"] as const).map((field) => <Input key={field} aria-label={`Activity ${index + 1} ${field}`} placeholder={field} value={activity[field]} maxLength={field === "highlight" ? 80 : 160} onChange={(event) => setDraft((current) => ({ ...current, activities: current.activities.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: event.target.value } : item) }))} />)}
                  </div>
                </section>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={safeDraft.activities.length >= MAX_PORTFOLIO_LIST_ITEMS} onClick={() => setDraft((current) => ({ ...current, activities: [...current.activities, { id: createId("activity"), prefix: "", highlight: "", suffix: "", order: current.activities.length }] }))}><Plus className="mr-1 h-4 w-4" /> Add activity</Button>
            </fieldset>
            <div className="border-t pt-4">
              <Field label="Wall post"><Textarea rows={5} value={safeDraft.profile.wallPost} maxLength={1000} onChange={(event) => updateProfile({ wallPost: event.target.value })} /></Field>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Wall date"><Input type="datetime-local" value={safeDraft.profile.wallDate} onChange={(event) => updateProfile({ wallDate: event.target.value })} /></Field>
                <Field label="Reaction text"><Input value={safeDraft.profile.wallLikes} maxLength={120} onChange={(event) => updateProfile({ wallLikes: event.target.value })} /></Field>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            {safeDraft.projects.map((project, projectIndex) => (
              <section key={project.id} className="space-y-3 rounded-md border p-4" aria-label={`Edit ${project.title || `project ${projectIndex + 1}`}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Project {projectIndex + 1}</h3><OrderControls label={project.title || `project ${projectIndex + 1}`} index={projectIndex} total={safeDraft.projects.length} onMove={(direction) => setDraft((current) => ({ ...current, projects: moveItem(current.projects, projectIndex, direction) }))} onRemove={() => setDraft((current) => ({ ...current, projects: normalizeItemOrder(current.projects.filter((_, index) => index !== projectIndex)) }))} /></div>
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                  <Field label="Title"><Input value={project.title} placeholder="Project title" maxLength={80} onChange={(event) => updateProject(projectIndex, { title: event.target.value })} /></Field>
                  <Field label="Month"><Input type="month" value={project.date} onChange={(event) => updateProject(projectIndex, { date: event.target.value })} /></Field>
                </div>
                <Field label="Description"><Textarea value={project.description} placeholder="What did you build, analyze, or improve?" maxLength={500} onChange={(event) => updateProject(projectIndex, { description: event.target.value })} /></Field>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Links</legend>
                  {project.links.map((link, linkIndex) => (
                    <div key={`${project.id}-link-${linkIndex}`} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                      <Input aria-label={`Link ${linkIndex + 1} label for ${project.title || `project ${projectIndex + 1}`}`} placeholder="GitHub Repo" value={link.label} maxLength={40} onChange={(event) => updateProjectLink(projectIndex, linkIndex, "label", event.target.value)} />
                      <Input aria-label={`Link ${linkIndex + 1} URL for ${project.title || `project ${projectIndex + 1}`}`} placeholder="https://example.com/project" value={link.href} maxLength={2048} onChange={(event) => updateProjectLink(projectIndex, linkIndex, "href", event.target.value)} />
                      <Button type="button" variant="outline" size="icon" aria-label={`Remove link ${linkIndex + 1} from ${project.title || `project ${projectIndex + 1}`}`} disabled={project.links.length === 1} onClick={() => updateProject(projectIndex, { links: project.links.filter((_, index) => index !== linkIndex) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" disabled={project.links.length >= 3} onClick={() => updateProject(projectIndex, { links: [...project.links, { label: "", href: "" }] })}><Plus className="mr-1 h-4 w-4" /> Add link</Button>
                </fieldset>
              </section>
            ))}
            <Button type="button" variant="outline" disabled={safeDraft.projects.length >= MAX_PORTFOLIO_PROJECTS} onClick={() => setDraft((current) => ({ ...current, projects: [...current.projects, createProject(current.projects.length)] }))}><Plus className="mr-1 h-4 w-4" /> Add project</Button>
          </TabsContent>

          <TabsContent value="skills" className="space-y-3">
            {safeDraft.skills.map((skill, index) => (
              <section key={skill.id} className="space-y-2 rounded-md border p-3" aria-label={`Edit ${skill.name || `skill ${index + 1}`}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Skill {index + 1}</span><OrderControls label={skill.name || `skill ${index + 1}`} index={index} total={safeDraft.skills.length} onMove={(direction) => setDraft((current) => ({ ...current, skills: moveItem(current.skills, index, direction) }))} onRemove={() => setDraft((current) => ({ ...current, skills: normalizeItemOrder(current.skills.filter((_, itemIndex) => itemIndex !== index)) }))} /></div>
                <Input aria-label={`Skill ${index + 1} name`} placeholder="Skill name" value={skill.name} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} />
                <Input aria-label={`Skill ${index + 1} tools`} placeholder="Tools and methods" value={skill.tools} maxLength={240} onChange={(event) => setDraft((current) => ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, tools: event.target.value } : item) }))} />
                <Textarea aria-label={`Skill ${index + 1} evidence`} placeholder="Evidence of use" value={skill.evidence} maxLength={400} onChange={(event) => setDraft((current) => ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, evidence: event.target.value } : item) }))} />
              </section>
            ))}
            <Button type="button" variant="outline" disabled={safeDraft.skills.length >= MAX_PORTFOLIO_LIST_ITEMS} onClick={() => setDraft((current) => ({ ...current, skills: [...current.skills, { id: createId("skill"), name: "", tools: "", evidence: "", order: current.skills.length }] }))}><Plus className="mr-1 h-4 w-4" /> Add skill</Button>
          </TabsContent>

          <TabsContent value="certifications" className="space-y-3">
            {safeDraft.certifications.map((certification, index) => (
              <section key={certification.id} className="space-y-2 rounded-md border p-3" aria-label={`Edit ${certification.title || `certification ${index + 1}`}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Certification {index + 1}</span><OrderControls label={certification.title || `certification ${index + 1}`} index={index} total={safeDraft.certifications.length} onMove={(direction) => setDraft((current) => ({ ...current, certifications: moveItem(current.certifications, index, direction) }))} onRemove={() => setDraft((current) => ({ ...current, certifications: normalizeItemOrder(current.certifications.filter((_, itemIndex) => itemIndex !== index)) }))} /></div>
                <div className="grid gap-2 sm:grid-cols-[120px_1fr_180px]">
                  <Input aria-label={`Certification ${index + 1} code`} placeholder="Code" value={certification.code} maxLength={12} onChange={(event) => setDraft((current) => ({ ...current, certifications: current.certifications.map((item, itemIndex) => itemIndex === index ? { ...item, code: event.target.value } : item) }))} />
                  <Input aria-label={`Certification ${index + 1} title`} placeholder="Certification title" value={certification.title} maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, certifications: current.certifications.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) }))} />
                  <Input aria-label={`Certification ${index + 1} issued`} type="month" value={certification.issued} onChange={(event) => setDraft((current) => ({ ...current, certifications: current.certifications.map((item, itemIndex) => itemIndex === index ? { ...item, issued: event.target.value } : item) }))} />
                </div>
                <Input aria-label={`Certification ${index + 1} URL`} type="url" value={certification.href} maxLength={2048} onChange={(event) => setDraft((current) => ({ ...current, certifications: current.certifications.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item) }))} />
              </section>
            ))}
            <Button type="button" variant="outline" disabled={safeDraft.certifications.length >= MAX_PORTFOLIO_LIST_ITEMS} onClick={() => setDraft((current) => ({ ...current, certifications: [...current.certifications, { id: createId("certification"), code: "", title: "", issued: new Date().toISOString().slice(0, 7), href: "", order: current.certifications.length }] }))}><Plus className="mr-1 h-4 w-4" /> Add certification</Button>
          </TabsContent>
        </Tabs>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={saving} onClick={handleSave}>{saving ? "Publishing..." : "Publish page changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
