#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

try {
  if (process.argv.includes('--time-require')) {
    require('time-require');
  }
} catch {}

require('please-upgrade-node')(require('../package.json'));
require('loud-rejection/register');

try {
  require('source-map-support/register');
} catch {}

require('../lib/cli');
