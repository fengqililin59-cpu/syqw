/**
 * @file 需求探索登记完整度（BANT/SPIN 字段）。
 */

export const DISCOVERY_FIELD_KEYS = [
  'budget',
  'decision_timeline',
  'pain_points',
  'product_interest',
  'decision_maker',
  'next_step',
];

export const DISCOVERY_FIELD_LABELS = {
  budget: '预算范围',
  decision_timeline: '决策周期',
  pain_points: '痛点与诉求',
  product_interest: '关注产品',
  decision_maker: '决策人',
  next_step: '下一步计划',
};

/**
 * @param {object|null|undefined} profile
 */
export function computeDiscoveryMeta(profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  const missing = [];
  let filled = 0;
  for (const key of DISCOVERY_FIELD_KEYS) {
    const v = String(p[key] ?? '').trim();
    if (v) filled += 1;
    else missing.push(DISCOVERY_FIELD_LABELS[key] || key);
  }
  const total = DISCOVERY_FIELD_KEYS.length;
  const percent = Math.round((filled / total) * 100);
  return {
    discovery_completeness_percent: percent,
    discovery_fields_filled: filled,
    discovery_fields_total: total,
    discovery_ready: percent >= 67,
    discovery_missing_labels: missing,
  };
}

/**
 * @param {object} plain
 */
export function attachDiscoveryMeta(plain) {
  if (!plain || typeof plain !== 'object') return plain;
  return {
    ...plain,
    ...computeDiscoveryMeta(plain.discovery_profile),
  };
}
