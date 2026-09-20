import test from 'node:test';
import assert from 'node:assert/strict';

import { loginSchema } from '../src/modules/auth/validation.js';

test('allows development .local demo emails for login in development mode', () => {
  const result = loginSchema.validate({
    email: 'demo.admin@kicks.local',
    password: 'KicksDemo@2026!',
  });

  assert.equal(result.error, undefined);
});
