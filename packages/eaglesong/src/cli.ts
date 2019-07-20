import _ from 'lodash';
import yargs from 'yargs';
import * as commands from './commands';

_.each(commands, Command => new Command().register());
yargs
  .alias('h', 'help')
  .alias('v', 'version')
  .locale('en')
  .demandCommand(1, '')
  .strict()
  .parse();
