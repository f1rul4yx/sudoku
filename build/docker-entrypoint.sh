#!/bin/sh
set -e

MAX_RETRIES=30
RETRY_COUNT=0

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 2
done

[ $RETRY_COUNT -eq $MAX_RETRIES ] && echo "Error: PostgreSQL not ready" && exit 1

exec "$@"