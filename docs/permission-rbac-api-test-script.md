# RBAC 可执行验收脚本（API）

这份文档用于把 `docs/permission-rbac-audit-checklist.md` 的检查项落成可执行步骤。

## 1) 环境变量

```bash
export BASE_URL="http://127.0.0.1:3000/api/v1"
export ADMIN_TENANT_ID="1"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your_password"
```

## 2) 管理员登录并取 Token

```bash
ADMIN_TOKEN=$(
  curl -sS -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenant_id\": $ADMIN_TENANT_ID,
      \"username\": \"$ADMIN_USERNAME\",
      \"password\": \"$ADMIN_PASSWORD\"
    }" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.data?.token||'')})"
)

echo "ADMIN_TOKEN length: ${#ADMIN_TOKEN}"
```

通过标准：
- `ADMIN_TOKEN` 长度大于 0。

## 3) 创建测试角色（最小权限）

> 以下步骤演示创建 3 个测试角色：`qa_customer_view`、`qa_broadcast_view`、`qa_dashboard_view`。

```bash
curl -sS -X POST "$BASE_URL/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"qa_customer_view","permissions":["customer:view"],"description":"QA only customer:view"}'

curl -sS -X POST "$BASE_URL/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"qa_broadcast_view","permissions":["broadcast:view"],"description":"QA only broadcast:view"}'

curl -sS -X POST "$BASE_URL/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"qa_dashboard_view","permissions":["dashboard:view"],"description":"QA only dashboard:view"}'
```

通过标准：
- 返回 `code=0`（或业务成功态）。

## 4) 给测试用户分配角色并登录

先在后台创建一个测试用户（如 `qa_user`），然后用管理员接口更新该用户 `role_id`。

```bash
# 1. 先查询角色列表，找到目标 role_id
curl -sS "$BASE_URL/roles" -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. 更新用户角色（示例：user_id=10, role_id=21）
curl -sS -X PUT "$BASE_URL/users/10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role_id":21}'
```

再用测试用户登录获取 `QA_TOKEN`：

```bash
export QA_TENANT_ID="1"
export QA_USERNAME="qa_user"
export QA_PASSWORD="qa_password"

QA_TOKEN=$(
  curl -sS -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenant_id\": $QA_TENANT_ID,
      \"username\": \"$QA_USERNAME\",
      \"password\": \"$QA_PASSWORD\"
    }" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.data?.token||'')})"
)

echo "QA_TOKEN length: ${#QA_TOKEN}"
```

## 5) 核心验收用例（403 / 200）

> 每组都用同一个 `QA_TOKEN` 执行，观察是否符合预期。

### A. `customer:view` 角色

```bash
# 应该成功（200）
curl -i -sS "$BASE_URL/customers?page=1&page_size=10" \
  -H "Authorization: Bearer $QA_TOKEN"

# 应该拒绝（403）
curl -i -sS -X POST "$BASE_URL/customers" \
  -H "Authorization: Bearer $QA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"rbac-test","phone":"13800000000"}'
```

预期：
- GET `/customers` => 200
- POST `/customers` => 403

### B. `broadcast:view` 角色

```bash
# 应该成功（200）
curl -i -sS "$BASE_URL/broadcast-tasks?page=1&page_size=10" \
  -H "Authorization: Bearer $QA_TOKEN"

# 应该拒绝（403）
curl -i -sS -X POST "$BASE_URL/broadcast-tasks" \
  -H "Authorization: Bearer $QA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"rbac-test","content_type":"text","content_text":"hello","run_now":false}'
```

预期：
- GET `/broadcast-tasks` => 200
- POST `/broadcast-tasks` => 403

### C. `dashboard:view` 角色

```bash
# 应该成功（200）
curl -i -sS "$BASE_URL/dashboard/overview" \
  -H "Authorization: Bearer $QA_TOKEN"

curl -i -sS "$BASE_URL/ads/roi?start_date=2026-05-01&end_date=2026-05-06" \
  -H "Authorization: Bearer $QA_TOKEN"

# 应该拒绝（403）
curl -i -sS -X POST "$BASE_URL/ads/jobs" \
  -H "Authorization: Bearer $QA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"job_type":"ads_roi_daily","job_date":"2026-05-06"}'
```

预期：
- GET `/dashboard/overview`、GET `/ads/roi` => 200
- POST `/ads/jobs` => 403

### D. `settings:manage` 与 `audit:view` 解耦验证

```bash
# 仅 settings:manage 时，用户管理应成功
curl -i -sS "$BASE_URL/users" \
  -H "Authorization: Bearer $QA_TOKEN"

# 仅 settings:manage 时，审计日志应拒绝（若未授予 audit:view）
curl -i -sS "$BASE_URL/settings/audit-logs?page=1&page_size=10" \
  -H "Authorization: Bearer $QA_TOKEN"
```

预期：
- GET `/users` => 200
- GET `/settings/audit-logs` => 403（没有 `audit:view` 时）

## 6) 快速排错

- 401：通常是 Token 过期、Header 格式不是 `Bearer <token>`、或用户被禁用。
- 403：RBAC 生效，缺少对应 `requirePerm` 权限码。
- 404：接口路径或 API 前缀错误；本项目前缀是 `/api/v1`。

## 7) 建议纳入 CI 的冒烟集

至少保留 6 条自动化断言：
- `customer:view`：`GET /customers = 200`，`POST /customers = 403`
- `broadcast:view`：`GET /broadcast-tasks = 200`，`POST /broadcast-tasks = 403`
- `dashboard:view`：`GET /ads/roi = 200`，`POST /ads/jobs = 403`

这样可以在后续改路由时，第一时间发现权限回归。

## 8) 一键脚本

仓库已提供脚本：`scripts/rbac-smoke.sh`

示例：

```bash
TOKEN="your_jwt" SCENARIO=customer_view scripts/rbac-smoke.sh
TENANT_ID=1 USERNAME=qa_user PASSWORD=qa_password SCENARIO=all scripts/rbac-smoke.sh
```
