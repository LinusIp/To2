import AppShell from "@/components/ui/AppShell";
import LessonPlayer from "@/components/lesson/LessonPlayer";

export default async function LessonPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  return (
    <AppShell>
      <LessonPlayer skillId={skillId} />
    </AppShell>
  );
}
