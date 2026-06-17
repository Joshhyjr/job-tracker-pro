import { useState, type FormEvent } from "react";
import { Github, Linkedin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionReveal } from "./SectionReveal";
import { useToast } from "@/hooks/use-toast";

const links = [
  { icon: Linkedin, label: "LinkedIn", href: "https://www.linkedin.com/in/joshua-kivaria/" },
  { icon: Github, label: "GitHub", href: "https://github.com/Joshhyjr" },
];

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  // Sends through a server endpoint so the destination inbox stays in environment variables.
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
    <section id="contact" className="container py-20">
      <SectionReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Get in touch</h2>
          <p className="mt-3 text-muted-foreground">
            Have a role, project, or idea in mind? I'd love to hear from you.
          </p>
        </div>
      </SectionReveal>

      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-5">
        <SectionReveal className="md:col-span-3">
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="message">Message</Label>
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

        <SectionReveal className="md:col-span-2" delay={120}>
          <div className="glass h-full rounded-2xl p-6 sm:p-8">
            <h3 className="font-display text-lg font-semibold">Find me online</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Prefer to reach out directly? Pick a channel that works for you.
            </p>
            <ul className="mt-5 space-y-3">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/10"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <l.icon className="h-4 w-4" />
                    </span>
                    <span className="font-medium">{l.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground group-hover:text-foreground">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
