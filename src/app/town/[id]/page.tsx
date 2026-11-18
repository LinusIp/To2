import TownScreen from "@/components/town/TownScreen";

export default async function TownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TownScreen townId={id} />;
}
