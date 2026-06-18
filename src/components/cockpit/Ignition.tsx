import { useState, type FormEvent } from "react";
import { Github, Linkedin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import SectionPanel from "./SectionPanel";
import { SectionReveal } from "./SectionReveal";
import { useToast } from "@/hooks/use-toast";

const links = [
  { icon: Linkedin, label: "LinkedIn", href: "https://www.linkedin.com/in/joshua-kivaria/" },
  { icon: Github, label: "GitHub", href: "https://github.com/Joshhyjr" },
];

export default function Ignition() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  // Sends through the existing /api/contact endpoint so the destination inbox stays server-side.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!response.ok) throw new Error("Contact request failed");
      setName("");
      setEmail("");
      setMessage("");
      toast({ title: "Message sent", description: "Thanks for reaching out. I'll get back to you soon." });
    } catch {
      toast({
        title: "Message not sent",
        description: "Please try again later or reach out through LinkedIn.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <SectionPanel
      id="ignition"
      eyebrow="07 · Start the Engine"
      title="Let's talk"
      description="Have a role, project, or idea? Drop a note or reach me directly."
    >
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-5">
        <SectionReveal className="md:col-span-3">
          <form onSubmit={handleSubmit} className="glass rounded-xl p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Name
                </Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="message" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Message
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                placeholder="Tell me a little about what you have in mind..."
              />
            </div>
            <div className="mt-6">
              <Button type="submit" size="lg" disabled={sending}>
                <Send /> {sending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </form>
        </SectionReveal>

        <SectionReveal className="md:col-span-2" delay={100}>
          <div className="glass-subtle flex h-full flex-col rounded-xl p-6 sm:p-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Direct channels
            </div>
            <h3 className="mt-1 font-display text-lg font-semibold">Reach me directly</h3>
            <ul className="mt-5 space-y-2.5">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-secondary/60"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-primary">
                      <l.icon className="h-4 w-4" />
                    </span>
                    <span className="font-medium">{l.label}</span>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground group-hover:text-foreground">
                      Open →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </SectionReveal>
      </div>
    </SectionPanel>
  );
}
