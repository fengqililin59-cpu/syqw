/**
 * @file 广告平台识别与知乎回传注册 smoke test。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferPlatform } from '../adTracking.service.js';
import { listSupportedConversionPlatforms } from './index.js';

describe('inferPlatform', () => {
  it('recognizes zhihu by platform param', () => {
    assert.equal(inferPlatform({ platform: 'zhihu' }), 'zhihu');
    assert.equal(inferPlatform({ platform: 'ZH' }), 'zhihu');
  });

  it('keeps existing platforms', () => {
    assert.equal(inferPlatform({ platform: 'ocean' }), 'ocean');
    assert.equal(inferPlatform({ clickid: 'x' }), 'ocean');
    assert.equal(inferPlatform({ bd_vid: 'v' }), 'baidu');
  });
});

describe('listSupportedConversionPlatforms', () => {
  it('includes zhihu', () => {
    const ids = listSupportedConversionPlatforms().map((p) => p.id);
    assert.ok(ids.includes('zhihu'));
  });
});
