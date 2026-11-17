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

const W = 210;
const H = 64;

const STYLE: Record<RoadmapNode["status"], { bg: string; border: string; dashed?: boolean; text: string }> = {
  mastered: { bg: "#c9efc6", border: "#1b1a17", text: "#1b1a17" },
  current: { bg: "#ffc83d", border: "#1b1a17", text: "#1b1a17" },
  next: { bg: "#ffffff", border: "#1b1a17", dashed: true, text: "#1b1a17" },
  optional: { bg: "#ffffff", border: "#8a857a", dashed: true, text: "#5c584f" },
  locked: { bg: "#e4dfd3", border: "#8a857a", text: "#4f4b43" },
};

function SkillNode({ data }: NodeProps<Node<{ n: RoadmapNode }>>) {
  const n = data.n;
  const s = STYLE[n.status];
  return (
    <div
      className={n.status === "current" ? "node-current" : ""}
      style={{
        width: W,
        minHeight: H,
        background: s.bg,
        border: `3px ${s.dashed ? "dashed" : "solid"} ${s.border}`,
        borderRadius: 12,
        padding: "6px 10px",
        color: s.text,
        boxShadow: n.status === "current" ? "4px 4px 0 #1b1a17" : undefined,
        cursor: n.status === "locked" ? "default" : "pointer",
        fontFamily: "var(--font-body)",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800 }}>
        {n.status === "mastered" ? <Check size={13} strokeWidth={3.5} /> : n.status === "locked" ? <Lock size={12} /> : n.status === "current" ? <Play size={12} /> : null}
        {t.roadmap.status[n.status]}
        {n.weak && <span style={{ marginLeft: "auto", fontSize: 10, border: "2px solid #1b1a17", borderRadius: 5, padding: "0 4px", background: "#fff" }}>{t.roadmap.weak}</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>{n.title}</div>
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
          es.push({ id: `${p}-${n.id}`, source: p, target: n.id, style: { stroke: "#1b1a17", strokeWidth: hot ? 3 : 2, opacity: hot ? 0.9 : 0.35, strokeDasharray: hot ? undefined : "6 6" } });
        }),
    );
    dagre.layout(g);
    const out: Node<{ n: RoadmapNode }>[] = ns.map((n) => {
      const p = g.node(n.id);
      return { id: n.id, type: "skill", position: { x: p.x - W / 2, y: p.y - H / 2 }, data: { n }, draggable: false, connectable: false };
    });
    return { nodes: out, edges: es };
  }, [roadmap]);

  const cur = nodes.find((n) => n.id === roadmap.currentId);

  return (
    <div className="h-[70dvh] min-h-[460px] overflow-hidden rounded-2xl border-[3px] border-ink bg-paper">
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
          if (rn.status !== "locked") router.push(`/lesson/${rn.id}`);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="#e4dfd3" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
