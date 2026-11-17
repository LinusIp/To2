"use client";
// roadmap.sh-style skill graph: React Flow + dagre (top→bottom). Tap a node → lesson.
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, Controls, Handle, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Check, Lock, Play } from "lucide-react";
import type { Roadmap, RoadmapNode } from "@/lib/learning/roadmap";
import { t } from "@/i18n/uz";
import { isOpen, lockReason } from "@/lib/learning/access";

const W = 210;
const H = 64;

const STYLE: Record<RoadmapNode["status"], { bg: string; border: string; dashed?: boolean; text: string }> = {
  mastered: { bg: "#e7f8ee", border: "#22b45a", text: "#141a3a" },
  current: { bg: "#2f6bff", border: "#2f6bff", text: "#ffffff" },
  next: { bg: "#ffffff", border: "#f0a400", dashed: true, text: "#141a3a" },
  optional: { bg: "#ffffff", border: "#c9d1e6", dashed: true, text: "#6b7393" },
  locked: { bg: "#e9edf7", border: "#dfe4f1", text: "#8a92b0" },
};

function SkillNode({ data }: NodeProps<Node<{ n: RoadmapNode; reason: string | null }>>) {
  const n = data.n;
  const s = STYLE[n.status];
  return (
    <div
      className={n.status === "current" ? "node-current" : ""}
      style={{
        width: W,
        minHeight: H,
        background: s.bg,
        border: `2px ${s.dashed ? "dashed" : "solid"} ${s.border}`,
        borderRadius: 16,
        padding: "6px 10px",
        color: s.text,
        boxShadow: n.status === "current" ? "0 10px 22px rgba(47,107,255,.35)" : "0 4px 12px rgba(31,54,120,.06)",
        cursor: n.status === "locked" ? "default" : "pointer",
        fontFamily: "var(--font-body)",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800 }}>
        {n.status === "mastered" ? <Check size={13} strokeWidth={3.5} /> : n.status === "locked" ? <Lock size={12} /> : n.status === "current" ? <Play size={12} /> : null}
        {t.roadmap.status[n.status]}
        {n.weak && <span style={{ marginLeft: "auto", fontSize: 10, borderRadius: 8, padding: "0 6px", background: "#fff4e8", color: "#c2410c" }}>{t.roadmap.weak}</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>{n.title}</div>
      {data.reason && <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>{data.reason}</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { skill: SkillNode };

export default function RoadmapGraph({ roadmap }: { roadmap: Roadmap }) {
  const router = useRouter();
  const { nodes, edges } = useMemo(() => {
    // Show the learner's path + mastered + direct neighbours, to keep the graph readable.
    const keep = new Set(roadmap.nodes.filter((n) => n.onPath || n.status === "mastered" || n.status === "optional").map((n) => n.id));
    const ns = roadmap.nodes.filter((n) => keep.has(n.id));
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB", nodesep: 26, ranksep: 46 });
    g.setDefaultEdgeLabel(() => ({}));
    ns.forEach((n) => g.setNode(n.id, { width: W, height: H }));
    const es: Edge[] = [];
    ns.forEach((n) =>
      n.prereqs
        .filter((p) => keep.has(p))
        .forEach((p) => {
          g.setEdge(p, n.id);
          const hot = n.onPath;
          es.push({ id: `${p}-${n.id}`, source: p, target: n.id, style: { stroke: hot ? "#2f6bff" : "#8a92b0", strokeWidth: hot ? 3 : 2, opacity: hot ? 0.9 : 0.35, strokeDasharray: hot ? undefined : "6 6" } });
        }),
    );
    dagre.layout(g);
    const out: Node<{ n: RoadmapNode }>[] = ns.map((n) => {
      const p = g.node(n.id);
      return { id: n.id, type: "skill", position: { x: p.x - W / 2, y: p.y - H / 2 }, data: { n, reason: lockReason(roadmap, n) }, draggable: false, connectable: false };
    });
    return { nodes: out, edges: es };
  }, [roadmap]);

  const cur = nodes.find((n) => n.id === roadmap.currentId);

  return (
    <div className="card h-[70dvh] min-h-[460px] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, nodes: cur ? [{ id: cur.id }] : undefined, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.4}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, n) => {
          const rn = (n.data as { n: RoadmapNode }).n;
          if (isOpen(rn)) router.push(`/lesson/${rn.id}`);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="#e3e8f6" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
