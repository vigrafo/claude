import { redirect } from "next/navigation";

/** Link aus der Einladungs-E-Mail → Mitgliederbereich (Anmeldung erforderlich). */
export default async function PaarBeitretenWeiterleitung({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  redirect(`/app/paar-beitreten${token ? `?token=${encodeURIComponent(token)}` : ""}`);
}
