"use client";
// Mockup v2 quiz (screen s5): the selected tutor bottom-right in a thinking idle — alternating the
// think1 / think2 renders with a gentle sway, floating "?" and a "Hmm…" bubble. A correct answer →
// cheer hop; a wrong one → keeps thinking (the hint shows above).
import { useEffect, useState } from "react";
import TutorPortrait from "@/components/characters/TutorPortrait";

export default function QuizThinker({ characterId, happy }: { characterId: string; happy: boolean }) {
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setAlt((a) => !a), 1700);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className={`quiz-thinker ${happy ? "happy" : ""}`} aria-hidden>
      {!happy && (
        <>
          <span className="cloud">Hmm…</span>
          <span className="q" style={{ left: 18, top: 30 }}>?</span>
          <span className="q" style={{ left: 110, top: 16, animationDelay: "-.8s" }}>?</span>
          <span className="q" style={{ left: 64, top: -6, animationDelay: "-1.6s", fontSize: 16 }}>x?</span>
        </>
      )}
      {happy ? (
        <TutorPortrait id={characterId} pose="cheer" frame="half" alt="" className="img hop" />
      ) : (
        <>
          <TutorPortrait id={characterId} pose="think1" frame="half" alt="" className="img" style={{ opacity: alt ? 0 : 1 }} />
          <TutorPortrait id={characterId} pose="think2" frame="half" alt="" className="img" style={{ opacity: alt ? 1 : 0 }} />
        </>
      )}
    </div>
  );
}
