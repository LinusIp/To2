import AppShell from "@/components/ui/AppShell";
import LessonPlayer from "@/components/lesson/LessonPlayer";

export default async function LessonPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId: raw } = await params;
  // "Istalgan mavzu" ids carry the topic text (t:Fotosintez) → may arrive URL-encoded
  let skillId = raw;
  try {
    skillId = decodeURIComponent(raw);
  } catch {}
  return (
    <AppShell wide hideTabs>
      <LessonPlayer skillId={skillId} />
    </AppShell>
  );
}
