import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AppError } from "./errors";

/**
 * Privater Medienspeicher. Zwei Treiber:
 *  - "s3": S3-kompatibel (MinIO, Produktion empfohlen). Bucket ist privat; Auslieferung nur über
 *    die rechtegeprüfte Route /app/medien/[id] (kein öffentlicher Bucket, keine erratbaren Direkt-URLs).
 *  - "local": Verzeichnis außerhalb von /public (STORAGE_DIR, Standard ./storage). Für Entwicklung,
 *    Tests und Einzelserver-Betrieb (z. B. Plesk) mit eigenem Volume + Backup.
 * Auswahl: STORAGE_DRIVER, sonst s3 wenn S3_ENDPOINT gesetzt ist, sonst local.
 */
export interface Storage {
  driver: "s3" | "local";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  del(key: string): Promise<void>;
}

const KEY_RE = /^[a-z0-9/_-]+\.[a-z0-9]+$/;
function checkKey(key: string) {
  if (!KEY_RE.test(key) || key.includes("..")) throw new AppError("storage_key", "Ungültiger Speicherschlüssel.", 500);
}

function localStorage(): Storage {
  const root = path.resolve(process.env.STORAGE_DIR ?? "storage");
  const file = (key: string) => {
    checkKey(key);
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new AppError("storage_key", "Ungültiger Speicherschlüssel.", 500);
    return p;
  };
  return {
    driver: "local",
    async put(key, body) {
      const p = file(key);
      await mkdir(path.dirname(p), { recursive: true, mode: 0o700 });
      await writeFile(p, body, { mode: 0o600 });
    },
    async get(key) {
      try {
        return await readFile(file(key));
      } catch {
        return null;
      }
    },
    async del(key) {
      await rm(file(key), { force: true });
    },
  };
}

function s3Storage(): Storage {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new AppError("storage_config", "S3_BUCKET fehlt.", 500);
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION ?? "eu-central-1", forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? "", secretAccessKey: process.env.S3_SECRET_KEY ?? "" },
  });
  return {
    driver: "s3",
    async put(key, body, contentType) {
      checkKey(key);
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: process.env.S3_SSE === "true" ? "AES256" : undefined }));
    },
    async get(key) {
      checkKey(key);
      try {
        const o = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = await o.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      } catch {
        return null;
      }
    },
    async del(key) {
      checkKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    },
  };
}

let cached: Storage | null = null;
export function storage(): Storage {
  if (cached) return cached;
  const driver = process.env.STORAGE_DRIVER ?? (process.env.S3_ENDPOINT ? "s3" : "local");
  cached = driver === "s3" ? s3Storage() : localStorage();
  return cached;
}

/** Nur für Tests. */
export function resetStorageForTests() {
  cached = null;
}
