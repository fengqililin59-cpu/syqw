/**
 * @file 行业话术包：列表与导入租户话术库。
 */
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { ScriptLibraryItem } from '../models/index.js';
import { INDUSTRY_SCRIPT_PACKS } from '../data/industryScriptPacks.js';

export function listIndustryScriptPacks() {
  return INDUSTRY_SCRIPT_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    item_count: p.items.length,
  }));
}

export async function importIndustryScriptPack(auth, packId) {
  const pack = INDUSTRY_SCRIPT_PACKS.find((p) => p.id === String(packId));
  if (!pack) throw new HttpError(404, '行业话术包不存在', 404);

  const existing = await ScriptLibraryItem.findAll({
    where: { tenant_id: auth.tenantId, deleted_at: null },
    attributes: ['title'],
  });
  const titles = new Set(existing.map((r) => r.title));

  let created = 0;
  let skipped = 0;
  const createdIds = [];

  for (const item of pack.items) {
    if (titles.has(item.title)) {
      skipped += 1;
      continue;
    }
    const row = await ScriptLibraryItem.create({
      tenant_id: auth.tenantId,
      category: item.category,
      title: item.title,
      body: item.body,
      sort_order: item.sort_order ?? 0,
      created_by: auth.userId,
    });
    titles.add(item.title);
    createdIds.push(row.id);
    created += 1;
  }

  return {
    pack_id: pack.id,
    pack_name: pack.name,
    created,
    skipped,
    created_ids: createdIds,
  };
}

/** 租户是否已导入过某行业包（按 category 前缀判断） */
export async function getIndustryPackStatus(auth) {
  const rows = await ScriptLibraryItem.findAll({
    where: {
      tenant_id: auth.tenantId,
      deleted_at: null,
      category: { [Op.like]: 'industry_%' },
    },
    attributes: ['category'],
    raw: true,
  });
  const cats = new Set(rows.map((r) => r.category));
  return INDUSTRY_SCRIPT_PACKS.map((p) => {
    const prefix = `industry_${p.id}`;
    const imported = p.items.some((it) => cats.has(it.category));
    return { id: p.id, imported };
  });
}
