// Empty / loading / error states: a friendly tutor + one line of Uzbek (+ optional action).
import type { ReactNode } from "react";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { ui } from "@/i18n/uz-ui";

type Pose = "wave" | "idle" | "thumbs" | "point";

function StateBox({ tutor, pose, text, action, role, tone }: { tutor: string; pose: Pose; text: string; action?: ReactNode; role?: "status" | "alert"; tone: "calm" | "warn" }) {
  return (
    <div role={role} className="anim-in mx-auto flex max-w-[360px] flex-col items-center gap-3 px-6 py-8 text-center">
      <div className={`grid h-[132px] w-[132px] place-items-center overflow-hidden rounded-full ${tone === "warn" ? "bg-[#fff1e6]" : "bg-blue-50"}`}>
        <TutorPortrait id={tutor} pose={pose} frame="half" alt="" className="float-y h-[128px] w-[128px]" />
      </div>
      <p className="t-body m-0 text-ink">{text}</p>
      {action}
    </div>
  );
}

export function EmptyState({ tutor = "blokbek", text = ui.empty, action }: { tutor?: string; text?: string; action?: ReactNode }) {
  return <StateBox tutor={tutor} pose="wave" text={text} action={action} tone="calm" />;
}

export function LoadingState({ tutor = "blokbek", text = ui.loading }: { tutor?: string; text?: string }) {
  return <StateBox tutor={tutor} pose="idle" text={text} role="status" tone="calm" />;
}

export function ErrorState({ tutor = "blokbek", text = ui.error, onRetry }: { tutor?: string; text?: string; onRetry?: () => void }) {
  return (
    <StateBox
      tutor={tutor}
      pose="point"
      text={text}
      role="alert"
      tone="warn"
      action={
        onRetry && (
          <button type="button" className="btn btn-primary mt-1 min-w-[200px]" onClick={onRetry}>
            {ui.retry}
          </button>
        )
      }
    />
  );
}
