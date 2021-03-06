#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

try {
  if (process.argv.includes('--time-require')) {
    require('time-require');
  }
} catch {}

require('v8-compile-cache');
require('please-upgrade-node')(require('../package.json'));

try {
  require('source-map-support/register');
} catch {}

require('./cli');
