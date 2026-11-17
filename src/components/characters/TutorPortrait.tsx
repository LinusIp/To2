"use client";
// <TutorPortrait id pose frame/> — a still image of a tutor.
// 1) /characters/<id>_<pose>_<frame>.png if the team added it (listed in characterRenders.json at build time)
// 2) else a three.js render of the voxel rig (lazy-loaded, cached)
import { useEffect, useState } from "react";
import renders from "@/config/characterRenders.json";
import { getCharacter } from "@/config/characters";
import type { Pose } from "./voxel";
import type { Frame } from "./portraits";

const RENDERS = new Set<string>(renders as string[]);

export function blenderRender(id: string, pose: Pose, frame: Frame): string | null {
  const f = `${id}_${pose}_${frame}.png`;
  return RENDERS.has(f) ? `/characters/${f}` : null;
}

interface Props {
  id: string;
  pose?: Pose;
  frame?: Frame;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  /** locked tutor → dark silhouette */
  locked?: boolean;
}

export default function TutorPortrait({ id, pose = "idle", frame = "half", className, style, alt, locked }: Props) {
  const file = blenderRender(id, pose, frame);
  const [src, setSrc] = useState<string | null>(file);

  useEffect(() => {
    if (file) {
      setSrc(file);
      return;
    }
    let alive = true;
    // render after first paint so lists don't block scrolling
    const t = setTimeout(() => {
      import("./portraits").then((m) => {
        const url = m.renderPortrait(id, pose, frame);
        if (alive && url) setSrc(url);
      });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [file, id, pose, frame]);

  const label = alt ?? getCharacter(id).name;
  if (!src) return <span className={className} style={{ display: "block", ...style }} role="img" aria-label={label} />;
  const imgStyle: React.CSSProperties = { display: "block", pointerEvents: "none", userSelect: "none", objectFit: "contain", filter: locked ? "brightness(.15) saturate(0)" : undefined, opacity: locked ? 0.55 : undefined, ...style };
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={label} draggable={false} loading="lazy" decoding="async" className={className} style={imgStyle} />
  );
  // Blender renders ship as WebP (~30 KB) with the PNG as fallback
  if (file)
    return (
      <picture style={{ display: "contents" }}>
        <source srcSet={file.replace(/\.png$/, ".webp")} type="image/webp" />
        {img}
      </picture>
    );
  return img;
}
