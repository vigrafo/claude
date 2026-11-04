/**
 * Erstinstallation: legt den ersten Superadmin an (interaktiv).
 *   npm run admin:bootstrap               – verweigert, wenn bereits ein Superadmin existiert
 *   npm run admin:bootstrap -- --force-additional   – weiteren Superadmin anlegen
 *
 * Kein Standardpasswort. MFA (TOTP) ist Pflicht und wird erst nach gültigem Code gespeichert.
 * Die Identitätsprüfung (identityStatus) bleibt unberührt – Adminrechte ersetzen keine Verifizierung.
 */
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

if (!process.env.DATA_ENCRYPTION_KEY && existsSync(".env")) process.loadEnvFile(".env");

async function main() {
  const { db } = await import("../src/server/db");
  const { syncRbac } = await import("../src/server/rbac");
  const { hashPassword, validatePassword, newMfaSecret, checkTotp } = await import("../src/server/auth");
  const { encrypt } = await import("../src/server/crypto");
  const { audit } = await import("../src/server/audit");

  const force = process.argv.includes("--force-additional");
  const rl = createInterface({ input: stdin, output: stdout, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q: string): Promise<string> => {
    stdout.write(q);
    const r = await lines.next();
    if (r.done) throw new Error("Eingabe beendet – es wurde nichts gespeichert.");
    return String(r.value);
  };
  try {
    if (!process.env.DATA_ENCRYPTION_KEY) throw new Error("DATA_ENCRYPTION_KEY fehlt (wird für das MFA-Secret benötigt).");
    await syncRbac();
    const role = await db.role.findUniqueOrThrow({ where: { key: "superadmin" } });
    const existing = await db.roleAssignment.count({ where: { roleId: role.id, revokedAt: null, scopeType: null } });
    if (existing > 0 && !force) {
      console.error("Es existiert bereits ein Superadmin. Abbruch. (Weiteren Superadmin nur mit --force-additional anlegen.)");
      process.exitCode = 1;
      return;
    }

    const email = (await ask("E-Mail-Adresse des Superadmins: ")).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Ungültige E-Mail-Adresse.");
    if (await db.user.findUnique({ where: { email } })) throw new Error("Für diese Adresse existiert bereits ein Konto. Bitte Rolle im Backend vergeben (Vier-Augen-Freigabe).");

    console.log("Hinweis: Die Eingabe wird nicht verborgen. Mindestens 12 Zeichen.");
    const pw = await ask("Passwort: ");
    const err = validatePassword(pw);
    if (err) throw new Error(err);
    const pw2 = await ask("Passwort wiederholen: ");
    if (pw !== pw2) throw new Error("Die Passwörter stimmen nicht überein.");

    const { secret, otpauth } = newMfaSecret(email);
    console.log("\nRichte jetzt deine Authenticator-App ein:");
    console.log(`  Secret:      ${secret}`);
    console.log(`  otpauth-URI: ${otpauth}\n`);
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      const code = await ask("6-stelliger Code aus der App: ");
      ok = checkTotp(secret, code);
      if (!ok) console.log("Code ungültig – bitte erneut versuchen.");
    }
    if (!ok) throw new Error("Kein gültiger Code – es wurde nichts gespeichert.");

    const passwordHash = await hashPassword(pw);
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash, emailVerifiedAt: new Date(), mfaSecretEnc: encrypt(secret), mfaEnabledAt: new Date() },
      });
      await tx.roleAssignment.create({ data: { userId: u.id, roleId: role.id, grantedBy: "bootstrap" } });
      return u;
    });
    await audit("admin.bootstrap", { actorUserId: null, targetType: "user", targetId: user.id, meta: { role: "superadmin", additional: existing > 0 } });
    await audit("mfa.enabled", { actorUserId: user.id, targetType: "user", targetId: user.id });
    console.log(`\nSuperadmin angelegt (${user.id}). Anmeldung unter /admin/login.`);
  } catch (e) {
    console.error(`Fehler: ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
    await db.$disconnect();
  }
}

main();
