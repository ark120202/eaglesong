import isInstalledGlobally from 'is-installed-globally';
import _ from 'lodash';
import { inspect } from 'util';
import yargs from 'yargs';
import * as commands from './commands';

if (isInstalledGlobally) {
  throw new Error(
    "Eaglesong should be installed locally. Remove it with 'npm --global uninstall eaglesong' or 'yarn global remove eaglesong' and add to your project.",
  );
}

process.on('unhandledRejection', error => {
  const message =
    error instanceof Error ? error.stack : `Promise rejected with value: ${inspect(error)}`;

  console.error(message);
  process.exit(1);
});

_.each(commands, Command => new Command().register());
yargs
  .alias('h', 'help')
  .alias('v', 'version')
  .locale('en')
  .demandCommand(1, '')
  .strict()
  .parserConfiguration({ 'boolean-negation': false })
  .parse();
