/**
 * @file 知识库检索：向量相似度 + 关键词兜底。
 */
import { Op } from 'sequelize';
import { KbChunk, KbDocument } from '../models/index.js';
import { embedTexts } from './kbEmbedding.service.js';

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

async function activeDocumentIds(tenantId) {
  const docs = await KbDocument.findAll({
    where: { tenant_id: tenantId, status: 'active' },
    attributes: ['id'],
    limit: 500,
  });
  return docs.map((d) => d.id);
}

async function keywordSearch(tenantId, queryText, limit) {
  const kw = String(queryText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  if (!kw) return [];

  const docIds = await activeDocumentIds(tenantId);
  if (!docIds.length) return [];

  const terms = kw.split(/\s+/).filter((t) => t.length >= 2).slice(0, 3);
  const likeTerm = terms[0] || kw.slice(0, 12);

  const chunks = await KbChunk.findAll({
    where: {
      tenant_id: tenantId,
      document_id: { [Op.in]: docIds },
      content: { [Op.like]: `%${likeTerm}%` },
    },
    limit: limit * 2,
    order: [['id', 'DESC']],
  });
  return chunks.slice(0, limit).map((c) => ({
    id: c.id,
    content: c.content,
    score: 0.5,
    method: 'keyword',
  }));
}

async function vectorSearch(tenantId, queryText, limit) {
  const [queryVec] = await embedTexts([queryText]);
  if (!queryVec) return [];

  const docIds = await activeDocumentIds(tenantId);
  if (!docIds.length) return [];

  const chunks = await KbChunk.findAll({
    where: {
      tenant_id: tenantId,
      document_id: { [Op.in]: docIds },
      embedding_json: { [Op.ne]: null },
    },
    limit: 800,
    attributes: ['id', 'content', 'embedding_json'],
  });

  const scored = [];
  for (const c of chunks) {
    const vec = c.embedding_json;
    if (!Array.isArray(vec)) continue;
    const score = cosineSimilarity(queryVec, vec);
    if (score > 0.2) {
      scored.push({ id: c.id, content: c.content, score, method: 'vector' });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * @param {number} tenantId
 * @param {string} queryText
 * @param {number} [limit]
 */
export async function searchKbChunks(tenantId, queryText, limit = 3) {
  const q = String(queryText || '').trim();
  if (!q) return [];

  const vectorHits = await vectorSearch(tenantId, q, limit);
  if (vectorHits.length >= limit) return vectorHits;

  const keywordHits = await keywordSearch(tenantId, q, limit);
  const seen = new Set(vectorHits.map((h) => h.id));
  for (const h of keywordHits) {
    if (seen.has(h.id)) continue;
    vectorHits.push(h);
    seen.add(h.id);
    if (vectorHits.length >= limit) break;
  }
  return vectorHits.slice(0, limit);
}

/**
 * @param {number} tenantId
 * @param {string} queryText
 * @param {number} [limit]
 */
export async function formatKbContext(tenantId, queryText, limit = 3) {
  const hits = await searchKbChunks(tenantId, queryText, limit);
  if (!hits.length) return '';
  return hits.map((c, i) => `[知识${i + 1}] ${String(c.content).slice(0, 400)}`).join('\n');
}
