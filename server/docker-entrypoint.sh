#!/bin/sh
set -eu

mkdir -p "$(dirname "$DB_CONNECTION")"

if [ ! -s "$DB_CONNECTION" ]; then
    echo "Initializing SQLite database at $DB_CONNECTION"
    npm run db:rebuild
fi

exec "$@"
