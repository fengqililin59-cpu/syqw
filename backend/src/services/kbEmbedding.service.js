/**
 * @file 知识库向量：OpenAI 兼容 Embeddings API。
 */
import { env } from '../config/env.js';

function embeddingApiConfig() {
  const openaiKey = env.ai.openaiApiKey;
  const deepseekKey = env.ai.deepseekApiKey;
  const key = openaiKey || deepseekKey;
  if (!key) return null;

  if (openaiKey) {
    return {
      key: openaiKey,
      url: 'https://api.openai.com/v1/embeddings',
      model: env.kbEmbeddingModel || 'text-embedding-3-small',
    };
  }
  return {
    key: deepseekKey,
    url: `${env.ai.deepseekBaseUrl}/v1/embeddings`,
    model: env.kbEmbeddingModel || 'text-embedding-v1',
  };
}

/**
 * @param {string[]} texts
 * @returns {Promise<(number[] | null)[]>}
 */
export async function embedTexts(texts) {
  const cfg = embeddingApiConfig();
  if (!cfg || !texts.length) {
    return texts.map(() => null);
  }

  const inputs = texts.map((t) => String(t || '').slice(0, 8000));
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        input: inputs,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[kb-embed] API error', data?.error?.message || res.statusText);
      return texts.map(() => null);
    }
    const items = data?.data;
    if (!Array.isArray(items)) return texts.map(() => null);
    items.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return items.map((item) => (Array.isArray(item.embedding) ? item.embedding : null));
  } catch (e) {
    console.warn('[kb-embed]', e?.message || e);
    return texts.map(() => null);
  }
}

export function isEmbeddingAvailable() {
  return Boolean(embeddingApiConfig());
}
