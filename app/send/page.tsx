"use client";

import { useRouter } from "next/navigation";
import { SendScreen } from "@/components/flow/send";

export default function SendPage() {
  const router = useRouter();
  return (
    <div className="relative flex flex-1 flex-col">
      <SendScreen onClose={() => router.push("/")} />
    </div>
  );
}
