"use client";
// Layered pixel-SVG characters (from the team mockups). Parts animate independently:
// idle bob, blink, mouth driven by audio amplitude, pointing arm, thinking tilt, celebrate jump.
import { useEffect, useRef } from "react";
import type { CharacterId } from "@/config/characters";
import { mouth } from "@/lib/audio/lipsync";

export type CharacterState = "idle" | "talking" | "thinking" | "happy" | "celebrate" | "listening";

interface Props {
  id: CharacterId | string;
  size?: number; // width in px (height = 1.5 × width)
  state?: CharacterState;
  pointing?: boolean;
  /** static mouth animation instead of live amplitude (roadmap avatar etc.) */
  fakeTalk?: boolean;
  className?: string;
  title?: string;
}

function useMouth(ref: React.RefObject<SVGGElement | null>, live: boolean, fake: boolean) {
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    let raf = 0;
    let t = 0;
    const loop = () => {
      let amp = 0;
      if (live) amp = mouth.amp;
      else if (fake) {
        t += 0.22;
        amp = 0.5 + 0.5 * Math.sin(t);
      }
      const s = 0.25 + 0.95 * amp;
      g.style.transform = `scaleY(${s.toFixed(3)})`;
      raf = requestAnimationFrame(loop);
    };
    if (live || fake) raf = requestAnimationFrame(loop);
    else g.style.transform = "scaleY(1)";
    return () => cancelAnimationFrame(raf);
  }, [ref, live, fake]);
}

const MOUTH_STYLE: React.CSSProperties = { transformBox: "fill-box", transformOrigin: "center top" };
const ARM_STYLE = (pointing: boolean, ox: number, oy: number): React.CSSProperties => ({
  transformBox: "view-box",
  transformOrigin: `${ox}px ${oy}px`,
  transform: pointing ? "rotate(-28deg)" : "rotate(0deg)",
  transition: "transform 300ms ease",
});

function Blokbek({ mouthRef, pointing, happy }: { mouthRef: React.Ref<SVGGElement>; pointing: boolean; happy: boolean }) {
  return (
    <>
      {/* legs */}
      <rect x="45" y="170" width="30" height="52" fill="#2b3a55" />
      <rect x="85" y="170" width="30" height="52" fill="#2b3a55" />
      <rect x="42" y="220" width="34" height="12" fill="#1b1a17" />
      <rect x="84" y="220" width="34" height="12" fill="#1b1a17" />
      {/* body: orange vest with ikat pixels */}
      <rect x="30" y="90" width="100" height="82" fill="#f28c28" />
      <rect x="66" y="90" width="28" height="82" fill="#f4efe6" />
      {[100, 120, 140].map((y) => (
        <rect key={`l${y}`} x="36" y={y} width="10" height="10" fill="#b4410f" />
      ))}
      {[110, 130].map((y) => (
        <rect key={`ly${y}`} x="46" y={y} width="10" height="10" fill="#ffd85c" />
      ))}
      {[100, 120, 140].map((y) => (
        <rect key={`r${y}`} x="114" y={y} width="10" height="10" fill="#b4410f" />
      ))}
      {[110, 130].map((y) => (
        <rect key={`ry${y}`} x="104" y={y} width="10" height="10" fill="#ffd85c" />
      ))}
      <rect x="30" y="164" width="100" height="10" fill="#7c2d12" />
      <rect x="74" y="164" width="12" height="10" fill="#ffd85c" />
      {/* left arm */}
      <rect x="10" y="90" width="20" height="48" fill="#f4efe6" />
      <rect x="10" y="138" width="20" height="20" fill="#c98b5e" />
      {/* right arm + giant pixel pencil (points at the board) */}
      <g style={ARM_STYLE(pointing, 140, 100)}>
        <rect x="130" y="64" width="20" height="40" fill="#f4efe6" />
        <rect x="137" y="2" width="6" height="6" fill="#1b1a17" />
        <rect x="135" y="8" width="10" height="8" fill="#e8c39e" />
        <rect x="135" y="16" width="10" height="34" fill="#ffc83d" />
        <rect x="139" y="16" width="2" height="34" fill="#e0a800" />
        <rect x="130" y="48" width="20" height="18" fill="#c98b5e" />
      </g>
      {/* head */}
      <rect x="40" y="22" width="80" height="68" fill="#c98b5e" />
      <rect x="40" y="22" width="80" height="10" fill="#3b2416" />
      <rect x="40" y="32" width="8" height="18" fill="#3b2416" />
      <rect x="112" y="32" width="8" height="18" fill="#3b2416" />
      {/* do'ppi (skullcap) with pixel pattern */}
      <rect x="38" y="6" width="84" height="18" fill="#1b1a17" />
      <rect x="50" y="11" width="8" height="8" fill="#f4efe6" />
      <rect x="76" y="11" width="8" height="8" fill="#f4efe6" />
      <rect x="102" y="11" width="8" height="8" fill="#f4efe6" />
      {/* brows */}
      <rect x="54" y={happy ? 38 : 40} width="18" height="5" fill="#3b2416" />
      <rect x="88" y={happy ? 38 : 40} width="18" height="5" fill="#3b2416" />
      {/* eyes (blink) */}
      <g className="blink">
        <rect x="56" y="48" width="14" height="12" fill="#ffffff" />
        <rect x="62" y="48" width="8" height="12" fill="#1b1a17" />
        <rect x="90" y="48" width="14" height="12" fill="#ffffff" />
        <rect x="96" y="48" width="8" height="12" fill="#1b1a17" />
      </g>
      <rect x="76" y="58" width="8" height="10" fill="#b0754c" />
      <rect x="48" y="64" width="8" height="6" fill="#e7926f" />
      <rect x="104" y="64" width="8" height="6" fill="#e7926f" />
      <g ref={mouthRef} style={MOUTH_STYLE}>
        <rect x="68" y="72" width="24" height="10" fill="#6b2b1f" />
        <rect x="70" y="72" width="20" height="3" fill="#ffffff" />
      </g>
    </>
  );
}

function AgentShox({ mouthRef, pointing }: { mouthRef: React.Ref<SVGGElement>; pointing: boolean }) {
  return (
    <>
      <rect x="45" y="170" width="30" height="52" fill="#6b6a5e" />
      <rect x="85" y="170" width="30" height="52" fill="#6b6a5e" />
      <rect x="42" y="218" width="34" height="14" fill="#1b1a17" />
      <rect x="84" y="218" width="34" height="14" fill="#1b1a17" />
      <rect x="30" y="90" width="100" height="82" fill="#24324a" />
      <rect x="34" y="94" width="92" height="74" fill="#556b3a" />
      <rect x="40" y="122" width="24" height="20" fill="#43552d" />
      <rect x="96" y="122" width="24" height="20" fill="#43552d" />
      <rect x="88" y="100" width="22" height="12" fill="#ffc83d" />
      <rect x="30" y="164" width="100" height="8" fill="#1b1a17" />
      <rect x="10" y="90" width="20" height="50" fill="#24324a" />
      <rect x="10" y="140" width="20" height="18" fill="#e0ac7e" />
      {/* right arm + mission tablet */}
      <g style={ARM_STYLE(pointing, 140, 96)}>
        <rect x="130" y="90" width="20" height="40" fill="#24324a" />
        <rect x="130" y="128" width="20" height="16" fill="#e0ac7e" />
        <rect x="110" y="116" width="46" height="36" fill="#1b1a17" />
        <rect x="114" y="120" width="38" height="28" fill="#22d3ee" />
        <rect x="118" y="133" width="30" height="2" fill="#0e7490" />
        <rect x="132" y="123" width="2" height="22" fill="#0e7490" />
        <rect x="138" y="126" width="4" height="4" fill="#ffd85c" />
      </g>
      <rect x="40" y="22" width="80" height="68" fill="#e0ac7e" />
      <rect x="40" y="22" width="80" height="12" fill="#1b1a17" />
      {/* headset */}
      <rect x="36" y="14" width="88" height="8" fill="#2f855a" />
      <rect x="30" y="38" width="12" height="26" fill="#1f5f3f" />
      <rect x="118" y="38" width="12" height="26" fill="#1f5f3f" />
      <rect x="36" y="64" width="4" height="14" fill="#1b1a17" />
      <rect x="36" y="76" width="26" height="4" fill="#1b1a17" />
      <rect x="60" y="73" width="8" height="8" fill="#1b1a17" />
      {/* visor */}
      <g className="blink">
        <rect x="48" y="42" width="64" height="16" fill="#38bdf8" />
        <rect x="52" y="45" width="18" height="4" fill="#e0f7ff" />
      </g>
      <g ref={mouthRef} style={MOUTH_STYLE}>
        <rect x="74" y="72" width="20" height="8" fill="#7a3325" />
      </g>
    </>
  );
}

function RoboRayhon({ mouthRef, pointing, happy, thinking }: { mouthRef: React.Ref<SVGGElement>; pointing: boolean; happy: boolean; thinking: boolean }) {
  return (
    <>
      {/* wheels/feet */}
      <rect x="40" y="214" width="34" height="18" fill="#1b1a17" />
      <rect x="86" y="214" width="34" height="18" fill="#1b1a17" />
      <rect x="50" y="196" width="14" height="20" fill="#8a94a6" />
      <rect x="96" y="196" width="14" height="20" fill="#8a94a6" />
      {/* body cube */}
      <rect x="28" y="100" width="104" height="98" fill="#c7d2e4" />
      <rect x="28" y="100" width="104" height="8" fill="#9aa8c0" />
      <rect x="46" y="122" width="68" height="44" fill="#24324a" />
      <rect x="52" y="130" width="10" height="10" fill="#8be28b" />
      <rect x="68" y="130" width="10" height="10" fill="#ffd85c" />
      <rect x="84" y="130" width="10" height="10" fill="#ff9bb0" />
      <rect x="52" y="148" width="56" height="6" fill="#7cc7ff" />
      <rect x="28" y="184" width="104" height="8" fill="#9aa8c0" />
      {/* arms */}
      <rect x="10" y="110" width="18" height="44" fill="#9aa8c0" />
      <rect x="6" y="152" width="26" height="12" fill="#1b1a17" />
      <g style={ARM_STYLE(pointing, 141, 112)}>
        <rect x="132" y="110" width="18" height="44" fill="#9aa8c0" />
        <rect x="128" y="152" width="26" height="12" fill="#1b1a17" />
      </g>
      {/* neck + head with screen face */}
      <rect x="70" y="88" width="20" height="14" fill="#8a94a6" />
      <rect x="30" y="20" width="100" height="70" fill="#c7d2e4" />
      <rect x="38" y="28" width="84" height="54" fill="#1f2d27" />
      {/* antenna */}
      <rect x="77" y="6" width="6" height="14" fill="#8a94a6" />
      <rect x="73" y="0" width="14" height="8" fill={thinking ? "#ffd85c" : "#ff9bb0"} />
      {/* screen eyes */}
      <g className="blink">
        {happy ? (
          <>
            <rect x="50" y="42" width="6" height="6" fill="#8be28b" />
            <rect x="56" y="38" width="10" height="6" fill="#8be28b" />
            <rect x="66" y="42" width="6" height="6" fill="#8be28b" />
            <rect x="88" y="42" width="6" height="6" fill="#8be28b" />
            <rect x="94" y="38" width="10" height="6" fill="#8be28b" />
            <rect x="104" y="42" width="6" height="6" fill="#8be28b" />
          </>
        ) : (
          <>
            <rect x="52" y="38" width="16" height="16" fill="#8be28b" />
            <rect x="92" y="38" width="16" height="16" fill="#8be28b" />
            <rect x={thinking ? 52 : 60} y={thinking ? 38 : 42} width="6" height="6" fill="#1f2d27" />
            <rect x={thinking ? 92 : 100} y={thinking ? 38 : 42} width="6" height="6" fill="#1f2d27" />
          </>
        )}
      </g>
      <g ref={mouthRef} style={MOUTH_STYLE}>
        <rect x="64" y="62" width="32" height="10" fill="#8be28b" />
        <rect x="68" y="64" width="24" height="4" fill="#1f2d27" />
      </g>
    </>
  );
}

function Chaqmoq({ mouthRef, pointing }: { mouthRef: React.Ref<SVGGElement>; pointing: boolean }) {
  return (
    <>
      {/* speed lines */}
      <rect x="0" y="130" width="18" height="4" fill="#ffc83d" opacity="0.8" />
      <rect x="2" y="146" width="12" height="4" fill="#ffc83d" opacity="0.6" />
      <rect x="45" y="170" width="30" height="50" fill="#1b1a17" />
      <rect x="85" y="170" width="30" height="50" fill="#1b1a17" />
      <rect x="45" y="186" width="30" height="6" fill="#ffc83d" />
      <rect x="85" y="186" width="30" height="6" fill="#ffc83d" />
      <rect x="40" y="220" width="36" height="12" fill="#e2551b" />
      <rect x="84" y="220" width="36" height="12" fill="#e2551b" />
      {/* racing suit */}
      <rect x="30" y="92" width="100" height="80" fill="#e2551b" />
      <rect x="30" y="118" width="100" height="10" fill="#ffffff" />
      <path d="M76 98 h12 l-8 14 h10 l-16 22 l6 -16 h-10 z" fill="#ffc83d" stroke="#1b1a17" strokeWidth="2" />
      <rect x="30" y="164" width="100" height="8" fill="#1b1a17" />
      <rect x="10" y="94" width="20" height="46" fill="#e2551b" />
      <rect x="10" y="140" width="20" height="16" fill="#1b1a17" />
      <g style={ARM_STYLE(pointing, 140, 98)}>
        <rect x="130" y="94" width="20" height="46" fill="#e2551b" />
        <rect x="130" y="140" width="20" height="16" fill="#1b1a17" />
      </g>
      {/* block helmet */}
      <rect x="34" y="10" width="92" height="82" fill="#ffc83d" />
      <rect x="34" y="10" width="92" height="12" fill="#e0a800" />
      <rect x="34" y="52" width="10" height="20" fill="#e0a800" />
      <rect x="116" y="52" width="10" height="20" fill="#e0a800" />
      <rect x="76" y="10" width="8" height="40" fill="#e2551b" />
      {/* face window */}
      <rect x="44" y="30" width="72" height="54" fill="#d9a074" />
      <g className="blink">
        <rect x="54" y="44" width="14" height="10" fill="#1b1a17" />
        <rect x="92" y="44" width="14" height="10" fill="#1b1a17" />
        <rect x="56" y="45" width="4" height="4" fill="#ffffff" />
        <rect x="94" y="45" width="4" height="4" fill="#ffffff" />
      </g>
      <rect x="52" y="38" width="18" height="4" fill="#1b1a17" />
      <rect x="90" y="38" width="18" height="4" fill="#1b1a17" />
      <g ref={mouthRef} style={MOUTH_STYLE}>
        <rect x="68" y="66" width="24" height="9" fill="#6b2b1f" />
        <rect x="70" y="66" width="20" height="3" fill="#ffffff" />
      </g>
    </>
  );
}

const LABELS: Record<string, string> = {
  blokbek: "Blokbek — o'qituvchi qahramon",
  "agent-shox": "Agent Shox — o'qituvchi qahramon",
  "robo-rayhon": "Robo-Rayhon — o'qituvchi qahramon",
  chaqmoq: "Chaqmoq — o'qituvchi qahramon",
};

export default function Character({ id, size = 160, state = "idle", pointing = false, fakeTalk = false, className, title }: Props) {
  const mouthRef = useRef<SVGGElement>(null);
  const talking = state === "talking";
  useMouth(mouthRef, talking && !fakeTalk, talking && fakeTalk);
  const happy = state === "happy" || state === "celebrate";
  const thinking = state === "thinking" || state === "listening";
  const motion = state === "celebrate" ? "anim-jump" : thinking ? "anim-think" : "anim-bob";
  const h = Math.round(size * 1.5);

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 160 240"
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? LABELS[id] ?? "Qahramon"}
      className={className}
      style={{ overflow: "visible" }}
    >
      <rect x="34" y="232" width="92" height="8" fill="#1b1a17" opacity="0.15" />
      <g className={motion}>
        {id === "agent-shox" ? (
          <AgentShox mouthRef={mouthRef} pointing={pointing} />
        ) : id === "robo-rayhon" ? (
          <RoboRayhon mouthRef={mouthRef} pointing={pointing} happy={happy} thinking={thinking} />
        ) : id === "chaqmoq" ? (
          <Chaqmoq mouthRef={mouthRef} pointing={pointing} />
        ) : (
          <Blokbek mouthRef={mouthRef} pointing={pointing} happy={happy} />
        )}
        {state === "listening" && (
          <g>
            <rect x="140" y="20" width="6" height="10" fill="#f28c28" className="wv" />
            <rect x="150" y="14" width="6" height="16" fill="#f28c28" className="wv" />
          </g>
        )}
        {thinking && state !== "listening" && (
          <g>
            <rect x="132" y="6" width="8" height="8" fill="#ffffff" stroke="#1b1a17" strokeWidth="2" />
            <rect x="144" y="-6" width="12" height="12" fill="#ffffff" stroke="#1b1a17" strokeWidth="2" />
          </g>
        )}
      </g>
    </svg>
  );
}
