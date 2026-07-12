import { Flow } from "@/components/flow/flow";
import { demoLink } from "@/lib/mock";

// The hero flow, driven entirely by mock data for now.
// Real links will resolve at /t/[id] once the SDKs are wired in.
export default function Home() {
  return <Flow initialLink={demoLink} />;
}
