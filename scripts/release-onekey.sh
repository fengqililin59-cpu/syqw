#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
OPS_DOCS_DIR="${OPS_DOCS_DIR:-$ROOT_DIR/docs/ops}"
REMOTE_HOST="${REMOTE_HOST:-root@<ECS_IP>}"
REMOTE_BACKEND_DIR="${REMOTE_BACKEND_DIR:-/var/www/wework-saas/backend}"
REMOTE_FRONTEND_DIR="${REMOTE_FRONTEND_DIR:-/var/www/wework/}"
PM2_APP_NAME="${PM2_APP_NAME:-wework-api}"
HEALTH_PORT="${HEALTH_PORT:-3010}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://wework.syzs.top/health}"
SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD:-0}"
SKIP_FRONTEND_SYNC="${SKIP_FRONTEND_SYNC:-0}"
SKIP_BACKEND_DEPLOY="${SKIP_BACKEND_DEPLOY:-0}"
NO_CONFIRM="${NO_CONFIRM:-0}"
DISABLE_RELEASE_LOG="${DISABLE_RELEASE_LOG:-0}"
DRY_RUN="${DRY_RUN:-0}"

START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
RUN_DATE="$(date '+%Y%m%d')"
RUN_WINDOW_START="$(date '+%H:%M')"
LOG_FILE="$OPS_DOCS_DIR/daily-log-$RUN_DATE.md"
RUN_ID="$(date '+%Y%m%d-%H%M%S')"

frontend_build_status="SKIPPED"
frontend_sync_status="SKIPPED"
backend_deploy_status="SKIPPED"
health_status="SKIPPED"
release_status="RUNNING"
failed_step=""
git_branch="N/A"
git_head="N/A"
backend_head="N/A"
frontend_head="N/A"
git_status_short="N/A"

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue() { printf "\033[34m%s\033[0m\n" "$*"; }

run_or_echo() {
  if [[ "$DRY_RUN" == "1" ]]; then
    yellow "[DRY-RUN] $*"
    return 0
  fi
  eval "$@"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "缺少命令: $1"
    exit 1
  fi
}

confirm() {
  local prompt="$1"
  if [[ "$NO_CONFIRM" == "1" ]]; then
    return 0
  fi
  read -r -p "$prompt [y/N]: " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]]
}

ensure_log_file() {
  if [[ "$DISABLE_RELEASE_LOG" == "1" ]]; then
    return
  fi
  mkdir -p "$OPS_DOCS_DIR"
  if [[ ! -f "$LOG_FILE" ]]; then
    cat >"$LOG_FILE" <<EOF
# Daily Release Log - $RUN_DATE

> 自动生成文件。每次执行 \`scripts/release-onekey.sh\` 会追加一条记录。

EOF
  fi
}

append_release_log() {
  if [[ "$DISABLE_RELEASE_LOG" == "1" ]]; then
    return
  fi
  local end_ts run_window_end
  end_ts="$(date '+%Y-%m-%d %H:%M:%S')"
  run_window_end="$(date '+%H:%M')"
  cat >>"$LOG_FILE" <<EOF
## 发布记录 $RUN_ID

- 开始时间: \`$START_TS\`
- 结束时间: \`$end_ts\`
- 发布窗口: \`$RUN_WINDOW_START ~ $run_window_end\`
- 发布结论: \`$release_status\`
- 失败步骤: \`${failed_step:-无}\`

### 执行参数

- \`REMOTE_HOST=$REMOTE_HOST\`
- \`REMOTE_BACKEND_DIR=$REMOTE_BACKEND_DIR\`
- \`REMOTE_FRONTEND_DIR=$REMOTE_FRONTEND_DIR\`
- \`PM2_APP_NAME=$PM2_APP_NAME\`
- \`PUBLIC_HEALTH_URL=$PUBLIC_HEALTH_URL\`
- \`SKIP_FRONTEND_BUILD=$SKIP_FRONTEND_BUILD\`
- \`SKIP_FRONTEND_SYNC=$SKIP_FRONTEND_SYNC\`
- \`SKIP_BACKEND_DEPLOY=$SKIP_BACKEND_DEPLOY\`
- \`DRY_RUN=$DRY_RUN\`

### 代码快照

- \`branch=$git_branch\`
- \`repo_head=$git_head\`
- \`backend_head=$backend_head\`
- \`frontend_head=$frontend_head\`

#### git status --short

\`\`\`
$git_status_short
\`\`\`

### 执行结果

- 前端构建: \`$frontend_build_status\`
- 前端同步: \`$frontend_sync_status\`
- 后端发布: \`$backend_deploy_status\`
- 健康检查: \`$health_status\`

### 后续动作

- [ ] 按 \`docs/ops/checklists/post-release-30min.md\` 完成 30 分钟观察
- [ ] 如失败，按 \`docs/ops/checklists/rollback-quick.md\` 完成回滚

---

EOF
  green "发布日志已写入: $LOG_FILE"
}

capture_git_context() {
  if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return
  fi
  git_branch="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo N/A)"
  git_head="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo N/A)"
  backend_head="$(git -C "$ROOT_DIR" log -1 --format=%h -- backend 2>/dev/null || echo N/A)"
  frontend_head="$(git -C "$ROOT_DIR" log -1 --format=%h -- frontend 2>/dev/null || echo N/A)"
  git_status_short="$(git -C "$ROOT_DIR" status --short 2>/dev/null || true)"
  if [[ -z "$git_status_short" ]]; then
    git_status_short="(clean)"
  fi
}

print_plan() {
  blue "发布参数:"
  printf "  REMOTE_HOST=%s\n" "$REMOTE_HOST"
  printf "  REMOTE_BACKEND_DIR=%s\n" "$REMOTE_BACKEND_DIR"
  printf "  REMOTE_FRONTEND_DIR=%s\n" "$REMOTE_FRONTEND_DIR"
  printf "  PM2_APP_NAME=%s\n" "$PM2_APP_NAME"
  printf "  HEALTH_PORT=%s\n" "$HEALTH_PORT"
  printf "  PUBLIC_HEALTH_URL=%s\n" "$PUBLIC_HEALTH_URL"
  printf "  SKIP_FRONTEND_BUILD=%s\n" "$SKIP_FRONTEND_BUILD"
  printf "  SKIP_FRONTEND_SYNC=%s\n" "$SKIP_FRONTEND_SYNC"
  printf "  SKIP_BACKEND_DEPLOY=%s\n" "$SKIP_BACKEND_DEPLOY"
  printf "  DRY_RUN=%s\n" "$DRY_RUN"
}

run_prechecks() {
  blue "0/4 发布预检..."
  failed_step="precheck"
  if [[ ! -d "$FRONTEND_DIR" ]]; then
    red "前端目录不存在: $FRONTEND_DIR"
    exit 1
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    yellow "[DRY-RUN] ssh \"$REMOTE_HOST\" \"test -d \\\"$REMOTE_BACKEND_DIR\\\"\""
    yellow "[DRY-RUN] ssh \"$REMOTE_HOST\" \"test -d \\\"$REMOTE_FRONTEND_DIR\\\"\""
  else
    ssh "$REMOTE_HOST" "test -d \"$REMOTE_BACKEND_DIR\""
    ssh "$REMOTE_HOST" "test -d \"$REMOTE_FRONTEND_DIR\""
  fi
  green "预检通过。"
}

run_frontend_build() {
  if [[ "$SKIP_FRONTEND_BUILD" == "1" ]]; then
    yellow "跳过前端构建。"
    frontend_build_status="SKIPPED"
    return
  fi
  blue "1/4 前端构建..."
  failed_step="frontend_build"
  run_or_echo "npm run build --prefix \"$FRONTEND_DIR\""
  frontend_build_status="SUCCESS"
  green "前端构建完成。"
}

run_frontend_sync() {
  if [[ "$SKIP_FRONTEND_SYNC" == "1" ]]; then
    yellow "跳过前端同步。"
    frontend_sync_status="SKIPPED"
    return
  fi
  blue "2/4 前端同步到远端..."
  failed_step="frontend_sync"
  run_or_echo "rsync -avz --delete \"$FRONTEND_DIR/dist/\" \"$REMOTE_HOST:$REMOTE_FRONTEND_DIR\""
  frontend_sync_status="SUCCESS"
  green "前端同步完成。"
}

run_backend_deploy() {
  if [[ "$SKIP_BACKEND_DEPLOY" == "1" ]]; then
    yellow "跳过后端发布。"
    backend_deploy_status="SKIPPED"
    return
  fi
  blue "3/4 远端后端发布..."
  failed_step="backend_deploy"
  # DB: no npm migrate scripts in this repo; apply database/*.sql manually (docs/deploy/production-checklist.md §4.2).
  run_or_echo "ssh \"$REMOTE_HOST\" \"cd \\\"$REMOTE_BACKEND_DIR\\\" \
    && npm ci \
    && if npm run | rg -q '^  migrate:status'; then npm run migrate:status; fi \
    && if npm run | rg -q '^  migrate:up'; then npm run migrate:up; fi \
    && if pm2 describe \\\"$PM2_APP_NAME\\\" >/dev/null 2>&1; then pm2 restart \\\"$PM2_APP_NAME\\\" --update-env; else pm2 start src/app.js --name \\\"$PM2_APP_NAME\\\" --cwd \\\"$REMOTE_BACKEND_DIR\\\"; fi\""
  backend_deploy_status="SUCCESS"
  green "后端发布完成。"
}

run_health_checks() {
  blue "4/4 健康检查..."
  failed_step="health_checks"
  run_or_echo "ssh \"$REMOTE_HOST\" \"curl -fsS http://127.0.0.1:${HEALTH_PORT}/health >/dev/null\""
  run_or_echo "ssh \"$REMOTE_HOST\" \"curl -fsS \\\"http://127.0.0.1:${HEALTH_PORT}/health?deep=1\\\" | rg -q '\\\"database\\\":true'\""
  run_or_echo "curl -fsS \"$PUBLIC_HEALTH_URL\" >/dev/null"
  health_status="SUCCESS"
  green "健康检查通过（远端 local + 对外域名）。"
}

print_rollback_hint() {
  yellow "发布失败，建议执行快速回滚清单:"
  printf "  docs/ops/checklists/rollback-quick.md\n"
  printf "  关键命令:\n"
  printf "    ssh %s \"cd %s && npm ci && pm2 restart %s --update-env\"\n" "$REMOTE_HOST" "$REMOTE_BACKEND_DIR" "$PM2_APP_NAME"
}

main() {
  require_cmd npm
  require_cmd rsync
  require_cmd ssh
  require_cmd curl
  require_cmd rg
  require_cmd git

  capture_git_context
  print_plan
  ensure_log_file
  if ! confirm "确认开始发布?"; then
    yellow "已取消。"
    release_status="CANCELLED"
    append_release_log
    exit 0
  fi

  trap 'release_status="FAILED"; print_rollback_hint; append_release_log' ERR

  run_prechecks
  run_frontend_build
  run_frontend_sync
  run_backend_deploy
  run_health_checks

  failed_step=""
  release_status="SUCCESS"
  append_release_log
  green "发布完成。建议继续执行 docs/ops/checklists/post-release-30min.md"
}

main "$@"
