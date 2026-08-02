#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HRMS Security Audit Script
# Runs dependency scanning + secret scanning + OWASP ZAP
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  HRMS Security Audit — $(date)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"

# ─── 1. npm audit (dependency vulnerabilities) ───
echo -e "\n${YELLOW}[1/4] Running npm audit (backend)...${NC}"
cd hrms-backend
npm audit --audit-level=high || true
cd ..

echo -e "\n${YELLOW}[1/4] Running npm audit (frontend)...${NC}"
cd hrms-frontend
npm audit --audit-level=high || true
cd ..

# ─── 2. Dependency license check ───
echo -e "\n${YELLOW}[2/4] Checking for outdated packages (backend)...${NC}"
cd hrms-backend
npm outdated || true
cd ..

echo -e "\n${YELLOW}[2/4] Checking for outdated packages (frontend)...${NC}"
cd hrms-frontend
npm outdated || true
cd ..

# ─── 3. Secret scanning with git-secrets (if available) ───
echo -e "\n${YELLOW}[3/4] Scanning for secrets in source code...${NC}"
if command -v git-secrets &> /dev/null; then
  git secrets --scan
else
  echo -e "${YELLOW}⚠️  git-secrets not installed. Skipping.${NC}"
  echo "  Install: brew install git-secrets"
fi

# Check for common secret patterns
echo "Checking for hardcoded secrets..."
SECRET_PATTERNS=(
  "-----BEGIN.*PRIVATE KEY-----"
  "sk_live_" 
  "sk_test_"
  "AKIA[0-9A-Z]{16}"
  "ghp_[a-zA-Z0-9]{36}"
  "gho_[a-zA-Z0-9]{36}"
  "xox[bpsa]-[0-9]{10,13}"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
  matches=$(grep -r "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --exclude-dir=node_modules --exclude-dir=.git --exclude="package-lock.json" . 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo -e "${RED}❌ Potential secret found matching: $pattern${NC}"
    echo "$matches"
  fi
done

# ─── 4. OWASP ZAP DAST scan (if ZAP is running) ───
echo -e "\n${YELLOW}[4/4] Running OWASP ZAP DAST scan...${NC}"
if command -v zap-cli &> /dev/null; then
  zap-cli start
  zap-cli open-url "http://localhost:3001"
  zap-cli active-scan --scanners all "http://localhost:3001/api/v1/health"
  zap-cli report -o "zap-report.html" -f html
  zap-cli stop
  echo -e "${GREEN}✅ ZAP report generated: zap-report.html${NC}"
else
  echo -e "${YELLOW}⚠️  zap-cli not installed. Skipping.${NC}"
  echo "  Install: pip install zap-cli"
  echo "  Then start OWASP ZAP and run this script."
fi

echo -e "\n${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Security Audit Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
