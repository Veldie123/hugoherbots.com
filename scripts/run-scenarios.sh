#!/bin/bash
# Run scenario tests with auto-generated JWT and env vars from .env
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# Generate a fresh auth token
echo "Generating auth token..."
TOKEN=$(npx tsx --env-file=.env scripts/generate-test-token.ts 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to generate auth token"
  exit 1
fi
echo "Token generated (${#TOKEN} chars)"

# Run vitest with all needed env vars
SCENARIO_AUTH_TOKEN="$TOKEN" \
  node --env-file=.env \
  ./node_modules/.bin/vitest run --config vitest.config.scenarios.ts --reporter=verbose "$@"
