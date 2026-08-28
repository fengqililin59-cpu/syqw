/**
 * 一次性排查脚本：对比 Sequelize 模型定义与 database/ 下的迁移脚本，
 * 找出「有模型无迁移」的表，以及「模型声明了列但迁移里没建」的列。
 *
 * 列名取自 Sequelize 初始化后的 rawAttributes[].field（已应用 config/database.js
 * 里的 underscored / timestamps 全局默认），而不是正则解析模型源码。
 *
 * 迁移语料只取三位数字编号的迁移文件；local_* / docker-init / *_no_fk 是本地补丁，
 * 生产没有执行过，不能作为「已建表」的依据。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SQL_DIR = fileURLToPath(new URL('../../database/', import.meta.url));

/** 靠括号配对切出 CREATE TABLE 的括号体，避免依赖换行格式。 */
function extractCreateTables(sql) {
  const out = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?\s*\(/gi;
  let m;
  while ((m = re.exec(sql))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < sql.length && depth > 0) {
      if (sql[i] === '(') depth += 1;
      else if (sql[i] === ')') depth -= 1;
      i += 1;
    }
    out.push({ table: m[1], body: sql.slice(re.lastIndex, i - 1) });
  }
  return out;
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

const RESERVED = /^(primary|unique|key|index|constraint|fulltext|spatial|foreign|check)$/i;
const NOISE = /^(if|not|exists|column)$/i;

const migCols = new Map();
const migFiles = new Map();
function addCol(table, col, file) {
  const t = table.toLowerCase();
  if (!migCols.has(t)) migCols.set(t, new Set());
  migCols.get(t).add(col.toLowerCase());
  if (!migFiles.has(t)) migFiles.set(t, new Set());
  migFiles.get(t).add(file);
}

const sqlFiles = fs
  .readdirSync(SQL_DIR)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('._') && /^\d{3}_/.test(f))
  .sort();

for (const f of sqlFiles) {
  const sql = fs.readFileSync(path.join(SQL_DIR, f), 'utf8');
  for (const { table, body } of extractCreateTables(sql)) {
    for (const p of splitTopLevel(body)) {
      const cm = p.trim().match(/^`?([A-Za-z0-9_]+)`?/);
      if (cm && !RESERVED.test(cm[1])) addCol(table, cm[1], f);
    }
  }
  // 普通 ALTER 与 PREPARE 动态 SQL 字符串里的 ALTER 语法前缀相同，统一匹配。
  const alter = /ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?([^;]*)/gi;
  let m;
  while ((m = alter.exec(sql))) {
    const inner = /(?:ADD|MODIFY|CHANGE)\s+((?:(?:COLUMN|IF|NOT|EXISTS)\s+)*)`?([A-Za-z0-9_]+)`?/gi;
    let c;
    while ((c = inner.exec(m[2]))) {
      if (!RESERVED.test(c[2]) && !NOISE.test(c[2])) addCol(m[1], c[2], f);
    }
  }
}

const { sequelize } = await import('../src/config/database.js');
await import('../src/models/index.js');

const noMigration = [];
const colGaps = [];

for (const model of Object.values(sequelize.models)) {
  const table = model.getTableName().toLowerCase();
  const fields = [...new Set(Object.values(model.rawAttributes).map((a) => (a.field || a.fieldName).toLowerCase()))];
  if (!migCols.has(table)) {
    noMigration.push({ table, model: model.name });
    continue;
  }
  const have = migCols.get(table);
  const missing = fields.filter((c) => !have.has(c));
  if (missing.length) colGaps.push({ table, model: model.name, missing, files: [...migFiles.get(table)] });
}

const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));

console.log(`模型总数: ${Object.keys(sequelize.models).length}，扫描迁移文件: ${sqlFiles.length}\n`);
console.log('=== A. 有模型但编号迁移里完全没有 CREATE TABLE ===');
if (!noMigration.length) console.log('  (无)');
noMigration.sort((a, b) => a.table.localeCompare(b.table)).forEach((r) => console.log(`  ${pad(r.table, 34)}${r.model}`));

console.log('\n=== B. 模型声明的列在编号迁移里找不到 ===');
if (!colGaps.length) console.log('  (无)');
colGaps
  .sort((a, b) => a.table.localeCompare(b.table))
  .forEach((r) => console.log(`  ${pad(r.table, 32)}缺: ${r.missing.join(', ')}\n      迁移: ${r.files.join(', ')}`));

await sequelize.close().catch(() => {});
