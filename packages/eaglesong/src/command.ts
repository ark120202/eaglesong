import { findSteamAppByName, SteamNotFoundError } from 'find-steam-app';
import _ from 'lodash';
import mem from 'mem';
import readPkg from 'read-pkg';
import path from 'upath';
import yargs from 'yargs';
import { loadOptions } from './options';

export abstract class CommandGroup {
  protected readonly context = path.toUnix(process.cwd());
  protected args: {} = {};

  constructor() {
    this.getAddonName = mem(this.getAddonName);
    this.getDotaPath = mem(this.getDotaPath);
  }

  public abstract register(): void | Promise<void>;

  protected command(command: yargs.CommandModule<any, any>) {
    return yargs.command({
      ...command,
      handler: (args) => {
        this.args = args;
        command.handler(args);
      },
    });
  }

  protected async getPkg() {
    try {
      return await readPkg({ cwd: this.context });
    } catch (error) {
      throw error.code === 'ENOENT' ? new Error('package.json not found') : error;
    }
  }

  protected async getAddonName() {
    const pkgName = (await this.getPkg()).name;
    const options = await this.getOptions();
    const addonName = _.defaultTo(options.addonName, pkgName.toLowerCase().replace(/-/g, '_'));

    if (addonName === '') throw new Error('Addon name is not specified');
    if (!/^[a-z][\d_a-z]+$/.test(addonName)) {
      throw new Error(
        'Addon name may consist only of lowercase characters, digits, and underscores ' +
          'and should start with a letter',
      );
    }

    return addonName;
  }

  protected async getDotaPath() {
    const options = await this.getOptions();
    if (options.dotaPath != null) return options.dotaPath;

    let dotaPath;
    try {
      dotaPath = await findSteamAppByName('dota 2 beta');
    } catch (error) {
      if (!(error instanceof SteamNotFoundError)) throw error;
    }

    if (dotaPath == null) {
      throw new Error("Dota 2 wasn't found. You can specify it with a dotaPath option");
    }

    return dotaPath;
  }

  protected async getOptions() {
    return loadOptions(this.context);
  }
}
