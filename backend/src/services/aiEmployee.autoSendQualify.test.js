/**
 * @file qualifiesForInboxAutoSend 资格判定单测（node --test）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualifiesForInboxAutoSend } from './aiEmployee.service.js';

test('p0 FAQ：置信度达标且开启 faq 时通过', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p0', confidence: 0.75, intent: 'general' },
      { faqEnabled: true },
    ),
    true,
  );
});

test('p0 FAQ：置信度不足时不通过', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p0', confidence: 0.74, intent: 'general' },
      { faqEnabled: true },
    ),
    false,
  );
});

test('p0 FAQ：未开启 faq 时不通过', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p0', confidence: 0.9, intent: 'general' },
      { faqEnabled: false },
    ),
    false,
  );
});

test('p1 询价：置信度达标且开启 pricing 时通过', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p1', confidence: 0.85, intent: 'pricing' },
      { pricingEnabled: true },
    ),
    true,
  );
});

test('p1 询价：置信度不足时不通过', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p1', confidence: 0.84, intent: 'pricing' },
      { pricingEnabled: true },
    ),
    false,
  );
});

test('p1 询价：未开启 pricing 时不通过', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p1', confidence: 0.9, intent: 'pricing' },
      { pricingEnabled: false },
    ),
    false,
  );
});

test('p2 风险一律不自动发', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p2', confidence: 1, intent: 'general' },
      { faqEnabled: true, pricingEnabled: true },
    ),
    false,
  );
});

test('触发词含 PRICING_AUTO_BLOCK 关键词时不通过', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p0', confidence: 0.9, intent: 'general' },
      { faqEnabled: true, triggerText: '请发一份合同模板' },
    ),
    false,
  );
});

test('must_human 时不通过', () => {
  assert.equal(
    qualifiesForInboxAutoSend(
      { risk_level: 'p0', confidence: 0.9, intent: 'general' },
      { faqEnabled: true, must_human: true },
    ),
    false,
  );
});
