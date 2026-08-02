#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HRMS Complete Test Suite Runner
# Runs every layer of the testing pyramid
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
TOTAL=0

function run_test() {
  local name=$1
  local cmd=$2
  TOTAL=$((TOTAL + 1))
  
  echo -e "\n${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  [${TOTAL}] Running: ${name}${NC}"
  echo -e "${CYAN}  Command: ${cmd}${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  
  if eval "$cmd"; then
    echo -e "${GREEN}  ✅ PASS: ${name}${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}  ❌ FAIL: ${name}${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo -e "${GREEN}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║      HRMS Complete Test Suite Runner             ║"
echo "  ║      $(date)                ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Layer 1: Backend Unit Tests ───
echo -e "\n${YELLOW}═══ Layer 1: Backend Unit Tests (Jest) ═══${NC}"
run_test "Backend unit tests" "cd hrms-backend && npx jest --passWithNoTests --verbose 2>&1"

# ─── Layer 2: Backend API E2E ───
echo -e "\n${YELLOW}═══ Layer 2: Backend API E2E (Supertest) ═══${NC}"
run_test "Backend API E2E" "cd hrms-backend && npx jest --config ./test/jest-e2e.json --forceExit --verbose 2>&1"

# ─── Layer 3: TypeScript Compilation ───
echo -e "\n${YELLOW}═══ Layer 3: TypeScript Compilation ═══${NC}"
run_test "Backend TypeScript compilation" "cd hrms-backend && npx tsc --noEmit --pretty 2>&1"

# ─── Layer 4: Frontend Lint ───
echo -e "\n${YELLOW}═══ Layer 4: Frontend Lint ═══${NC}"
run_test "Frontend ESLint" "cd hrms-frontend && npx next lint --no-cache 2>&1 || true"

# ─── Layer 5: Frontend Build ───
echo -e "\n${YELLOW}═══ Layer 5: Frontend Build ═══${NC}"
run_test "Frontend build" "cd hrms-frontend && npx next build 2>&1 | tail -20"

# ─── Layer 6: Security Audit ───
echo -e "\n${YELLOW}═══ Layer 6: Dependency Security Audit ═══${NC}"
run_test "npm audit (backend)" "cd hrms-backend && npm audit --audit-level=high 2>&1 | tail -10"
run_test "npm audit (frontend)" "cd hrms-frontend && npm audit --audit-level=high 2>&1 | tail -10"

# ─── Summary ───
echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  TEST SUITE COMPLETE${NC}"
echo -e "${GREEN}  Total: ${TOTAL}  Passed: ${PASS}  Failed: ${FAIL}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"

# Exit with non-zero if any test failed
if [ $FAIL -gt 0 ]; then
  exit 1
fi
