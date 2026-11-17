// /dev/tutor — animation test bench for the 3D tutors (dev only; 404 in production builds).
import { notFound } from "next/navigation";
import DevTutor from "./DevTutor";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevTutor />;
}
