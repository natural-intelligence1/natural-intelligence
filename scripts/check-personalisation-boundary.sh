#!/usr/bin/env bash
# PS.3 — CI boundary check for getPersonalisationContext.
#
# Fails if `getPersonalisationContext` is imported from any path outside the
# allow-list:
#   • apps/web/app/dashboard/**     (authenticated dashboard subtree)
#   • apps/care/**                  (practitioner app — reserved for future use)
#   • packages/db/src/personalisation/** (the source module + its tests)
#
# This enforces §8 of the design proposal: the public marketing surface
# (apps/web/app outside /dashboard) must never read personalisation context.
#
# Use as part of CI or run manually:
#   bash scripts/check-personalisation-boundary.sh
#
# Exits 0 on pass, 1 on violation.

set -euo pipefail

cd "$(dirname "$0")/.."

# rg is preferred; fall back to grep -R if unavailable.
if command -v rg >/dev/null 2>&1; then
  matches="$(rg --no-heading --line-number --type ts --type tsx \
              --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**' \
              -e 'getPersonalisationContext' \
              apps packages 2>/dev/null || true)"
else
  matches="$(grep -RIn --include='*.ts' --include='*.tsx' \
              --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
              'getPersonalisationContext' \
              apps packages 2>/dev/null || true)"
fi

violations=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"

  # Allow-list:
  case "$file" in
    apps/web/app/dashboard/*)             continue ;;
    apps/care/*)                          continue ;;
    packages/db/src/personalisation/*)    continue ;;
  esac

  # Anything else is a violation.
  violations="${violations}${line}"$'\n'
done <<< "$matches"

if [ -n "$violations" ]; then
  echo "❌ PS.3 boundary violation — getPersonalisationContext imported outside the allow-list:" >&2
  echo "" >&2
  echo "$violations" >&2
  echo "" >&2
  echo "Allowed paths:" >&2
  echo "  • apps/web/app/dashboard/**" >&2
  echo "  • apps/care/**" >&2
  echo "  • packages/db/src/personalisation/**" >&2
  echo "" >&2
  echo "If a new caller is legitimate, add it to the allow-list in scripts/check-personalisation-boundary.sh AND state the architectural reasoning in the PR description." >&2
  exit 1
fi

echo "✅ PS.3 boundary check passed — getPersonalisationContext usage stays within the dashboard / care / personalisation source surfaces."
