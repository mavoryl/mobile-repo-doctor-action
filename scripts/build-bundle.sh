#!/usr/bin/env bash
# Rebuild the self-contained CLI bundle from the main repo.
# Run from the main mobile-repo-doctor repo root:
#   bash ../mobile-repo-doctor-action/scripts/build-bundle.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACTION_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building monorepo..."
pnpm build

echo "Bundling CLI into single file..."
npx esbuild packages/cli/src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile="$ACTION_DIR/dist/cli.cjs"

echo "Copying summary script..."
cp action/summary.mjs "$ACTION_DIR/dist/summary.mjs"

SIZE=$(wc -c < "$ACTION_DIR/dist/cli.cjs" | tr -d ' ')
echo "Done! Bundle size: $((SIZE / 1024))KB"
