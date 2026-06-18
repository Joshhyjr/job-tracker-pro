import PortfolioNav from "@/components/portfolio/PortfolioNav";
import Hero from "@/components/portfolio/Hero";
import About from "@/components/portfolio/About";
import Skills from "@/components/portfolio/Skills";
import Certifications from "@/components/portfolio/Certifications";
import Projects from "@/components/portfolio/Projects";
import Experience from "@/components/portfolio/Experience";
import Resume from "@/components/portfolio/Resume";
import Contact from "@/components/portfolio/Contact";
import Footer from "@/components/portfolio/Footer";
import { useEffect } from "react";

// Top-level portfolio page composed of scrollable sections.
export default function Portfolio() {
  // Force dark mode on the portfolio for the intended Midnight Indigo aesthetic.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!hadDark) root.classList.remove("dark");
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PortfolioNav />
      <main>
        <Hero />
        <About />
        <Skills />
        {/* Certifications follow skills so visitors can verify the supporting training. */}
        <Certifications />
        <Projects />
        <Experience />
        <Resume />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
