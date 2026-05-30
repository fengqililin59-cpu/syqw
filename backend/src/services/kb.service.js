/**
 * @file 知识库文档 CRUD（分块 + 向量索引，关键词兜底）。
 */
import Joi from 'joi';
import { KbDocument, KbChunk } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { paginated } from '../utils/response.js';
import { embedTexts, isEmbeddingAvailable } from './kbEmbedding.service.js';

function splitChunks(text, size = 500) {
  const s = String(text || '').trim();
  if (!s) return [];
  const out = [];
  for (let i = 0; i < s.length; i += size) {
    out.push(s.slice(i, i + size));
  }
  return out;
}

async function persistChunks(tenantId, documentId, parts) {
  const vectors = isEmbeddingAvailable() ? await embedTexts(parts) : parts.map(() => null);
  for (let i = 0; i < parts.length; i += 1) {
    await KbChunk.create({
      tenant_id: tenantId,
      document_id: documentId,
      chunk_index: i,
      content: parts[i],
      embedding_json: vectors[i],
    });
  }
  return {
    chunks: parts.length,
    embedded: vectors.filter(Boolean).length,
  };
}

export async function listDocuments(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const where = { tenant_id: auth.tenantId };
  if (query.status) where.status = String(query.status);
  const { rows, count } = await KbDocument.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order: [['updated_at', 'DESC']],
    attributes: ['id', 'title', 'category', 'status', 'created_at', 'updated_at'],
  });
  return paginated(rows.map((r) => r.get({ plain: true })), count, page, size);
}

const createSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  category: Joi.string().trim().max(64).allow('', null).optional(),
  content_text: Joi.string().trim().min(1).max(100000).required(),
}).unknown(false);

export async function createDocument(auth, body) {
  const { error, value } = createSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const doc = await KbDocument.create({
    tenant_id: auth.tenantId,
    title: value.title,
    category: value.category || null,
    content_text: value.content_text,
    status: 'active',
    created_by: auth.userId,
  });
  const parts = splitChunks(value.content_text);
  const indexStats = await persistChunks(auth.tenantId, doc.id, parts);
  const plain = doc.get({ plain: true });
  return { ...plain, index_stats: indexStats };
}

export async function getDocument(auth, id) {
  const doc = await KbDocument.findOne({
    where: { id, tenant_id: auth.tenantId },
  });
  if (!doc) {
    throw new HttpError(404, '文档不存在', 404);
  }
  return doc.get({ plain: true });
}

const updateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional(),
  category: Joi.string().trim().max(64).allow('', null).optional(),
  content_text: Joi.string().trim().min(1).max(100000).optional(),
  status: Joi.string().valid('active', 'archived').optional(),
})
  .min(1)
  .unknown(false);

export async function updateDocument(auth, id, body) {
  const { error, value } = updateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const doc = await KbDocument.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!doc) {
    throw new HttpError(404, '文档不存在', 404);
  }
  const patch = { ...value };
  if (patch.category === '') patch.category = null;
  await doc.update(patch);

  if (value.content_text != null) {
    await KbChunk.destroy({ where: { tenant_id: auth.tenantId, document_id: doc.id } });
    const parts = splitChunks(value.content_text);
    await persistChunks(auth.tenantId, doc.id, parts);
  }
  return doc.get({ plain: true });
}

export async function reindexDocument(auth, id) {
  const doc = await KbDocument.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!doc) {
    throw new HttpError(404, '文档不存在', 404);
  }
  await KbChunk.destroy({ where: { tenant_id: auth.tenantId, document_id: doc.id } });
  const parts = splitChunks(doc.content_text);
  const indexStats = await persistChunks(auth.tenantId, doc.id, parts);
  return {
    id: doc.id,
    title: doc.title,
    index_stats: indexStats,
    embedding_available: isEmbeddingAvailable(),
  };
}

export async function reindexAllDocuments(auth) {
  const docs = await KbDocument.findAll({
    where: { tenant_id: auth.tenantId, status: 'active' },
    order: [['id', 'ASC']],
  });
  let totalChunks = 0;
  let totalEmbedded = 0;
  for (const doc of docs) {
    await KbChunk.destroy({ where: { tenant_id: auth.tenantId, document_id: doc.id } });
    const parts = splitChunks(doc.content_text);
    const stats = await persistChunks(auth.tenantId, doc.id, parts);
    totalChunks += stats.chunks;
    totalEmbedded += stats.embedded;
  }
  return {
    documents: docs.length,
    chunks: totalChunks,
    embedded: totalEmbedded,
    embedding_available: isEmbeddingAvailable(),
  };
}

export async function archiveDocument(auth, id) {
  const doc = await KbDocument.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!doc) {
    throw new HttpError(404, '文档不存在', 404);
  }
  await doc.update({ status: 'archived' });
  return { id: Number(id), status: 'archived' };
}
