import CockpitNav from "@/components/cockpit/CockpitNav";
import Hero from "@/components/cockpit/Hero";
import DriverProfile from "@/components/cockpit/DriverProfile";
import PerformanceSpecs from "@/components/cockpit/PerformanceSpecs";
import Garage from "@/components/cockpit/Garage";
import JourneyLog from "@/components/cockpit/JourneyLog";
import Licenses from "@/components/cockpit/Licenses";
import SpecSheet from "@/components/cockpit/SpecSheet";
import Ignition from "@/components/cockpit/Ignition";
import CockpitFooter from "@/components/cockpit/CockpitFooter";

// Cockpit portfolio — minimal luxury performance dashboard.
// Scope the dark palette to this subtree so next-themes can't override it.
export default function Portfolio() {
  return (
    <div className="dark carbon-texture min-h-screen bg-background text-foreground">
      <CockpitNav />
      <main>
        <Hero />
        <DriverProfile />
        <PerformanceSpecs />
        <Garage />
        <JourneyLog />
        <Licenses />
        <SpecSheet />
        <Ignition />
      </main>
      <CockpitFooter />
    </div>
  );
}
