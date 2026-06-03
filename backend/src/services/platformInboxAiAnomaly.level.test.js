/**
 * @file classifyInboxAiAnomaly 分级逻辑单测（node --test）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInboxAiAnomaly } from './platformInboxAiAnomaly.service.js';

const base = { days: 7, auto_send_on: false };

test('无信号时返回 null', () => {
  assert.equal(classifyInboxAiAnomaly({ ...base, qa_failed: 0, qa_pending: 0, skip_count: 0 }), null);
});

test('单次抽检失败为关注', () => {
  const r = classifyInboxAiAnomaly({ ...base, qa_failed: 1, qa_pending: 0, skip_count: 0 });
  assert.equal(r?.level, 'warn');
  assert.ok(r?.reasons.some((x) => x.code === 'qa_failed'));
});

test('开启自动发且抽检失败为严重', () => {
  const r = classifyInboxAiAnomaly({
    ...base,
    auto_send_on: true,
    qa_failed: 1,
    qa_pending: 0,
    skip_count: 0,
  });
  assert.equal(r?.level, 'critical');
});

test('两次抽检失败为严重', () => {
  const r = classifyInboxAiAnomaly({ ...base, qa_failed: 2, qa_pending: 0, skip_count: 0 });
  assert.equal(r?.level, 'critical');
});

test('待抽检积压 >=3 记为关注', () => {
  const r = classifyInboxAiAnomaly({ ...base, qa_failed: 0, qa_pending: 3, skip_count: 0 });
  assert.equal(r?.level, 'warn');
  assert.ok(r?.reasons.some((x) => x.code === 'qa_pending'));
});

test('待抽检 >=8 为严重', () => {
  const r = classifyInboxAiAnomaly({ ...base, qa_failed: 0, qa_pending: 8, skip_count: 0 });
  assert.equal(r?.level, 'critical');
});

test('护栏跳过 >=15 为关注', () => {
  const r = classifyInboxAiAnomaly({ ...base, qa_failed: 0, qa_pending: 0, skip_count: 15 });
  assert.equal(r?.level, 'warn');
});

test('护栏跳过 >=40 为严重', () => {
  const r = classifyInboxAiAnomaly({ ...base, qa_failed: 0, qa_pending: 0, skip_count: 40 });
  assert.equal(r?.level, 'critical');
});
