/** Erzeugt docs/permissions.md aus der Code-Definition (src/server/rbac.ts). */
import { writeFileSync } from "node:fs";
import { PERMISSIONS, ROLES } from "../src/server/rbac";

const roles = Object.entries(ROLES);
let md = "# Rollen & Rechte (generiert aus `src/server/rbac.ts`)\n\nDefault deny. Gruppen- und Veranstalterrollen wirken nur im jeweiligen Scope und gewähren keinen Adminzugang.\n\n";
md += `| Recht | Beschreibung | ${roles.map(([, r]) => r.name).join(" | ")} |\n|---|---|${roles.map(() => "---").join("|")}|\n`;
for (const [k, label] of Object.entries(PERMISSIONS)) {
  md += `| \`${k}\` | ${label} | ${roles.map(([, r]) => (r.permissions.includes(k as never) ? "✓" : "")).join(" | ")} |\n`;
}
md += "\nKritische Rollen (Vergabe nur mit Vier-Augen-Freigabe): " + roles.filter(([, r]) => r.critical).map(([, r]) => r.name).join(", ") + ".\n";
md += "\nHinweis: Superadmin und Plattformadmin erhalten bewusst **keinen** Zugriff auf Verifizierungsbelege (`verification.evidence`) oder Belege gemeldeter privater Inhalte (`moderation.evidence`).\n";
writeFileSync("docs/permissions.md", md);
console.log("docs/permissions.md geschrieben");
