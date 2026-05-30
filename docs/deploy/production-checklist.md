# ZhiFlow 生产环境上线清单

## 一、服务器准备

### 1.1 基础环境
```bash
# Node.js 18+
node -v

# PM2
npm install -g pm2

# Nginx
nginx -v

# MySQL 8.0+
mysql --version
```

### 1.2 目录结构
```bash
mkdir -p /var/www/zhiflow
mkdir -p /var/log/pm2
mkdir -p /tmp/imports
```

---

## 二、代码部署

### 2.1 上传代码
```bash
# 方式一：git clone
cd /var/www/zhiflow
git clone your-repo .

# 方式二：rsync 本地上传
rsync -avz --exclude node_modules \
  ./backend/ root@服务器IP:/var/www/zhiflow/backend/
rsync -avz \
  ./frontend/dist/ root@服务器IP:/var/www/zhiflow/frontend/dist/
```

### 2.2 安装后端依赖
```bash
cd /var/www/zhiflow/backend
npm install --production
```

### 2.3 前端构建（本地执行后上传 dist）
```bash
cd frontend
npm install
npm run build
# 把 dist/ 目录上传到服务器
```

---

## 三、环境变量配置

复制并修改 .env：
```bash
cd /var/www/zhiflow/backend
cp .env.example .env
vim .env
```

**必须修改的配置项：**
```
NODE_ENV=production
PORT=3000

# 数据库（改为生产库地址）
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=zhiflow_prod
DB_USER=zhiflow
DB_PASS=强密码

# JWT（必须换成随机字符串，至少32位）
JWT_SECRET=换成随机字符串至少32位

# 域名
APP_URL=https://你的域名.com

# 企微（上线前必填）
WEWORK_CORP_ID=
WEWORK_AGENT_ID=
WEWORK_SECRET=
WEWORK_TOKEN=
WEWORK_ENCODING_AES_KEY=

# 关闭 Mock 模式
TCCC_MOCK=0
SMS_MOCK=0

# 开启定时任务
ENABLE_CAMPAIGN_REWARD_CRON=1
ENABLE_USAGE_SYNC_CRON=1
ENABLE_SUBSCRIPTION_EXPIRY_CRON=1
ENABLE_INTENT_ALERT_CRON=1
ENABLE_GROUP_SOP_CRON=1
ENABLE_SMS_CRON=1
```

---

## 四、数据库初始化

### 4.1 创建数据库
```bash
mysql -u root -p
```
```sql
CREATE DATABASE zhiflow_prod
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER 'zhiflow'@'localhost'
  IDENTIFIED BY '强密码';
GRANT ALL ON zhiflow_prod.*
  TO 'zhiflow'@'localhost';
FLUSH PRIVILEGES;
```

### 4.2 执行迁移（按顺序）
```bash
cd /var/www/zhiflow/backend
for f in database/0*.sql; do
  echo "执行 $f ..."
  mysql -u zhiflow -p zhiflow_prod < "$f"
done
```

### 4.3 验证关键表
```sql
-- 确认演示数据
SELECT COUNT(*) FROM customers
WHERE tenant_id = 9999;  -- 应为 30

-- 确认权限配置
SELECT COUNT(*) FROM permissions;  -- 应为 20

-- 确认套餐
SELECT code, name FROM plans;
```

---

## 五、Nginx 配置

### 5.1 申请 SSL 证书
```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 申请证书（先把域名解析指向服务器）
certbot --nginx -d 你的域名.com
```

### 5.2 部署 Nginx 配置
```bash
# 复制配置文件
cp deploy/nginx-zhiflow-production.conf \
  /etc/nginx/sites-available/zhiflow

# 修改配置里的域名
sed -i 's/YOUR_DOMAIN/你的域名.com/g' \
  /etc/nginx/sites-available/zhiflow

# 修改静态文件路径（如实际路径不同）
sed -i 's|/var/www/zhiflow|你的实际路径|g' \
  /etc/nginx/sites-available/zhiflow

# 启用站点
ln -s /etc/nginx/sites-available/zhiflow \
  /etc/nginx/sites-enabled/zhiflow

# 测试配置
nginx -t

# 重载
nginx -s reload
```

---

## 六、PM2 启动

### 6.1 启动服务
```bash
cd /var/www/zhiflow/backend

# 修改 ecosystem.config.js 里的路径
vim ecosystem.config.js
# 把 cwd 改为实际路径

# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs zhiflow-api --lines 50
```

### 6.2 设置开机自启
```bash
pm2 save
pm2 startup
# 按提示执行输出的命令
```

---

## 七、上线验证清单

按顺序验证，每项打勾：

### 基础功能
- [ ] `https://你的域名.com` 正常访问
- [ ] `https://你的域名.com/landing.html` 落地页正常
- [ ] `https://你的域名.com/demo` 跳转到演示系统
- [ ] 演示系统有 30 条客户数据
- [ ] 注册新账号正常
- [ ] 登录正常

### 企微集成
- [ ] 企微扫码登录正常
- [ ] 企微回调 URL 可访问（200 响应）
- [ ] 客户同步测试通过

### 核心功能
- [ ] 仪表盘数据加载正常
- [ ] 客户列表正常
- [ ] 意向预警页面正常
- [ ] 自动化流程可创建

### 性能与安全
- [ ] HTTPS 证书有效（浏览器无警告）
- [ ] API 响应时间 < 500ms
- [ ] 日志正常写入 `/var/log/pm2/`

---

## 八、上线后监控

```bash
# 实时查看日志
pm2 logs zhiflow-api

# 监控 CPU/内存
pm2 monit

# 定期查看错误
pm2 logs zhiflow-api --err --lines 100
```

---

## 九、常见问题

**Q：PM2 启动报错 Cannot find module**
```bash
cd /var/www/zhiflow/backend
npm install
```

**Q：数据库连接失败**
```bash
# 检查 MySQL 服务
systemctl status mysql
# 检查用户权限
mysql -u zhiflow -p zhiflow_prod -e "SELECT 1"
```

**Q：Nginx 502 Bad Gateway**
```bash
# 确认后端在运行
pm2 status
pm2 restart zhiflow-api
```

**Q：企微回调验证失败**
- 确认服务器已开放 443 端口
- 确认域名 SSL 证书有效
- 确认 `WEWORK_TOKEN` 和 `WEWORK_ENCODING_AES_KEY` 填写正确
