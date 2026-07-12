#!/usr/bin/env bash
# Respaldo diario de la base y las fotos de Vectaryx.
# Agendar con cron en el VPS (ver DESPLIEGUE.md):
#   0 4 * * * /opt/vectaryx/deploy/backup.sh >> /var/log/vectaryx-backup.log 2>&1
# Requiere sqlite3 en el host: apt install -y sqlite3
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="backups"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR"

# Copia consistente de SQLite aunque la app esté escribiendo (API .backup).
sqlite3 data/menu.db ".backup '$BACKUP_DIR/menu-$STAMP.db'"

# Fotos de menú, logos y QRs de cobro.
if [ -d data/uploads ]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C data uploads
fi

# Conserva 14 días de historia.
find "$BACKUP_DIR" -type f -mtime +14 -delete

echo "OK: respaldo $STAMP creado en $BACKUP_DIR/"
