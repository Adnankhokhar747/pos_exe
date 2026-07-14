#!/usr/bin/env bash
# Build the admin portal and deploy it into the PHP backend's public/admin/ folder.
#
# Usage:
#   ./scripts/deploy-admin-portal.sh https://api.yourserver.com
#
# The admin portal will then be reachable at:
#   https://yourserver.com/admin/           ← Super Admin login
#
# Prerequisites: Node 18+, pnpm (or npm) installed in the admin-portal folder.

set -e

API_URL="${1:-http://127.0.0.1:4000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ADMIN_PORTAL_DIR="$(cd "$BACKEND_DIR/../../apps/admin-portal" && pwd)"
PUBLIC_ADMIN_DIR="$BACKEND_DIR/public/admin"

echo "==> Building admin portal..."
echo "    API URL  : $API_URL"
echo "    Base path: /admin/"
echo "    Output   : $PUBLIC_ADMIN_DIR"

cd "$ADMIN_PORTAL_DIR"

VITE_ADMIN_BASE=/admin/ VITE_API_BASE_URL="$API_URL" npm run build

echo "==> Copying dist to $PUBLIC_ADMIN_DIR..."
rm -rf "$PUBLIC_ADMIN_DIR"
mkdir -p "$PUBLIC_ADMIN_DIR"
cp -r dist/. "$PUBLIC_ADMIN_DIR/"

echo ""
echo "Done. Visit https://yourserver.com/admin/ to access the Super Admin portal."
echo "Login: superadmin / Admin@1234"
