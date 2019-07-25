import isInstalledGlobally from 'is-installed-globally';
import _ from 'lodash';
import yargs from 'yargs';
import * as commands from './commands';

if (!isInstalledGlobally) {
  throw new Error(
    "Eaglesong should be installed locally. Remove it with 'npm --global uninstall eaglesong' or 'yarn global remove eaglesong' and install in your project.",
  );
}

_.each(commands, Command => new Command().register());
yargs
  .alias('h', 'help')
  .alias('v', 'version')
  .locale('en')
  .demandCommand(1, '')
  .strict()
  .parse();
