import { notFound } from "next/navigation";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Öffentliche Seiten aus dem CMS – Text wird escaped dargestellt (kein HTML/JS aus dem Backend). */
export default async function Seite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await db.publicPage.findUnique({ where: { slug } });
  if (!page) notFound();
  return (
    <div className="narrow section">
      <h1>{page.title}</h1>
      {page.body.split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{ whiteSpace: "pre-line" }}>{para}</p>
      ))}
    </div>
  );
}
