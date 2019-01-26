import _ from 'lodash';
import yargs from 'yargs';
import * as commands from './commands';

_.each(commands, c => new c().register());
yargs
  .alias('h', 'help')
  .alias('v', 'version')
  .locale('en')
  .demandCommand(1, '')
  .strict()
  .parse();
