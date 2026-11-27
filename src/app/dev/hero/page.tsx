// /dev/hero — TutorHero on its own (dev only; 404 in production builds).
import { notFound } from "next/navigation";
import DevHero from "./DevHero";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevHero />;
}
