#!/usr/bin/env bash
# Corre las pruebas del esquema en un PostgreSQL local.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/correr.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -X -q -t -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists club_belen_pruebas" -c "create database club_belen_pruebas" >/dev/null 2>&1
$P -d club_belen_pruebas -f tests/stub_supabase.sql 2>&1 | grep -v -i "wal_level\|HINT" || true
$P -d club_belen_pruebas -f migrations/20261111000000_esquema.sql >/dev/null
$P -d club_belen_pruebas -f migrations/20261111000100_imagenes.sql >/dev/null
$P -d club_belen_pruebas -f migrations/20261111000200_push.sql >/dev/null
$P -d club_belen_pruebas -f tests/pruebas.sql 2>&1 | sed -n 's/^.*NOTICE:  //p; s/^.*\(ERROR:.*\)$/\1/p; /TODAS LAS PRUEBAS/p'
$P -d club_belen_pruebas -f tests/pruebas_imagenes.sql 2>&1 | sed -n 's/^.*NOTICE:  //p; s/^.*\(ERROR:.*\)$/\1/p; /PASARON/p'
$P -d club_belen_pruebas -f tests/pruebas_push.sql 2>&1 | sed -n 's/^.*NOTICE:  //p; s/^.*\(ERROR:.*\)$/\1/p; /PASARON/p'
