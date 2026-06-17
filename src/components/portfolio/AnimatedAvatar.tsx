import { useEffect, useState } from "react";
// Friendly illustrated avatar — replace src/assets/avatar.png with your own image any time.
import avatarImg from "@/assets/avatar.png";

const FULL_TEXT = "Welcome! I'm Joshua — let me show you what I do.";

export default function AnimatedAvatar() {
  // Typing-style speech bubble effect
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let i = 0;
    const start = setTimeout(() => {
      const id = setInterval(() => {
        i++;
        setTyped(FULL_TEXT.slice(0, i));
        if (i >= FULL_TEXT.length) clearInterval(id);
      }, 38);
    }, 600);
    return () => clearTimeout(start);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Glow halo */}
      <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-tr from-primary/30 via-indigo-500/20 to-transparent blur-3xl" />

      {/* Speech bubble */}
      <div className="absolute -left-2 top-6 z-10 max-w-[260px] animate-fade-in glass rounded-2xl rounded-bl-sm px-4 py-3 text-sm shadow-lg sm:left-0">
        <span className="text-foreground/90">{typed}</span>
        <span className="ml-0.5 inline-block h-4 w-[2px] -translate-y-[1px] animate-blink bg-primary align-middle" />
      </div>

      {/* Floating avatar container */}
      <div className="relative animate-float">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] glass p-3">
          <img
            src={avatarImg}
            alt="Illustrated avatar of Joshua Kivaria waving"
            width={1024}
            height={1024}
            className="h-full w-full object-contain drop-shadow-[0_20px_40px_hsl(239_84%_60%/0.25)]"
          />
        </div>
        {/* Decorative orbit dots */}
        <span className="absolute -right-2 top-10 h-3 w-3 rounded-full bg-primary shadow-[0_0_20px_hsl(239_84%_60%)]" />
        <span className="absolute -bottom-2 left-10 h-2 w-2 rounded-full bg-indigo-300 shadow-[0_0_16px_hsl(239_84%_70%)]" />
      </div>
    </div>
  );
}
