"use client";
// Hands-free mode on every screen that has no recogniser of its own (the town / roadmap world, the
// games, home…): listens with the browser recogniser and sends each command as a "to2:voice" window event.
// "orqaga" / "bosh sahifa" work even when no screen handles them. The lesson and quiz screens claim
// the mic (claimListening) and this one pauses meanwhile.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import { useA11y } from "@/lib/a11y/settings";
import { parseVoiceCommand } from "@/lib/a11y/commands";
import { dispatchVoice, handlesBackItself, listeningClaimed, onClaimsChange } from "@/lib/a11y/bus";
import { listenForCommands, recognitionSupported } from "@/lib/a11y/recognition";
import { announce } from "@/lib/a11y/speech";

export default function GlobalVoiceCommands() {
  const router = useRouter();
  const on = useA11y((s) => s.loaded && s.handsFree);
  const [claimed, setClaimed] = useState(false);
  const [open, setOpen] = useState(false);
  const [heard, setHeard] = useState("");

  useEffect(() => onClaimsChange(() => setClaimed(listeningClaimed())), []);

  useEffect(() => {
    if (!on || claimed || !recognitionSupported()) return;
    return listenForCommands((text) => {
      const c = parseVoiceCommand(text);
      setHeard(text);
      if (!c) return announce(t.a11y.notCommand);
      if (dispatchVoice(c) || handlesBackItself(window.location.pathname)) return;
      // nobody on this screen handled it: the defaults
      if (c.type === "back") window.history.back();
      else if (c.type === "home") router.push("/home");
      else announce(t.a11y.heard(text));
    }, setOpen);
  }, [on, claimed, router]);

  if (!on || claimed || !open) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[84px] z-40 mx-auto w-fit max-w-[92vw] rounded-full bg-[#141a3a] px-4 py-2 text-[14px] font-extrabold text-white md:bottom-4" data-testid="global-voice">
      {t.a11y.listenOn}
      {heard ? ` · ${t.a11y.heard(heard)}` : ""}
    </div>
  );
}
