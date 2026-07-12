import { Flow } from "@/components/flow/flow";
import { Splash } from "@/components/splash";
import { demoLink } from "@/lib/mock";

// The hero flow, with the boot splash overlaid on first open.
export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      <Flow initialLink={demoLink} />
      <Splash />
    </div>
  );
}
