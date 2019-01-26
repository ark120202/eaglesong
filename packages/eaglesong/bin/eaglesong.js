#!/usr/bin/env node

try {
  if (process.argv.includes('--time-require')) require('time-require');
} catch {}

require('please-upgrade-node')(require('../package.json'));
require('loud-rejection/register');

try {
  require('source-map-support/register');
} catch {}

var importLocal = require('import-local');
if (!importLocal(__filename)) {
  require('../lib/cli');
}
