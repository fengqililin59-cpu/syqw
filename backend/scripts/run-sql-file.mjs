/**
 * 本地执行一个迁移 SQL 文件，用于验证幂等性。
 * 用 multipleStatements 而不是 mysql CLI，避免密码出现在命令行/ps 里。
 */
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const file = process.argv[2];
if (!file) {
  console.error('用法: node scripts/run-sql-file.mjs <path-to.sql>');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
});

try {
  await conn.query(fs.readFileSync(file, 'utf8'));
  console.log(`OK: ${file}`);
} catch (e) {
  console.error(`FAIL: ${file}\n  ${e.sqlMessage || e.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
