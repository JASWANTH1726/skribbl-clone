import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAllowedOrigins, isOriginAllowed } from './cors.js';

describe('CORS origin configuration', () => {
  it('parses and trims a comma-separated origin allowlist', () => {
    assert.deepEqual(
      [...getAllowedOrigins(' https://game.example,https://play.example ')],
      ['https://game.example', 'https://play.example']
    );
  });

  it('allows requests without an Origin header and configured origins only', () => {
    const allowedOrigins = new Set(['https://game.example']);

    assert.equal(isOriginAllowed(undefined, allowedOrigins), true);
    assert.equal(isOriginAllowed('https://game.example', allowedOrigins), true);
    assert.equal(isOriginAllowed('https://untrusted.example', allowedOrigins), false);
    assert.equal(isOriginAllowed('*', allowedOrigins), false);
  });
});
