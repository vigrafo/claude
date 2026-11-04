#!/bin/sh
# Legt in MinIO den privaten Bucket und einen eingeschränkten App-Benutzer an.
# Idempotent. Aufruf:
#   docker compose -f docker-compose.prod.yml --profile tools run --rm minio-init
# Erwartet aus .env.production: S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
# und als Docker-Secrets: minio_root_user, minio_root_password.
set -eu

: "${S3_BUCKET:?S3_BUCKET fehlt}"
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY fehlt}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY fehlt}"

ROOT_USER="$(cat /run/secrets/minio_root_user)"
ROOT_PASS="$(cat /run/secrets/minio_root_password)"

mc alias set eropub http://minio:9000 "$ROOT_USER" "$ROOT_PASS" >/dev/null

mc mb --ignore-existing "eropub/$S3_BUCKET"
# Bucket bleibt privat; Auslieferung nur über kurzlebige, signierte URLs der App.
mc anonymous set none "eropub/$S3_BUCKET"

POLICY=/tmp/eropub-app-policy.json
cat > "$POLICY" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::${S3_BUCKET}"] },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::${S3_BUCKET}/*"] }
  ]
}
EOF

mc admin policy create eropub eropub-app "$POLICY" 2>/dev/null || true
if ! mc admin user info eropub "$S3_ACCESS_KEY" >/dev/null 2>&1; then
  mc admin user add eropub "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
fi
mc admin policy attach eropub eropub-app --user "$S3_ACCESS_KEY" 2>/dev/null || true
rm -f "$POLICY"

echo "MinIO: Bucket '$S3_BUCKET' und App-Benutzer eingerichtet."
