import { spawn, SpawnOptions } from 'child_process';
import { DotaLanguage } from 'dota-data/lib/localization';
import path from 'upath';
import { CommandGroup } from '../command';

export interface LaunchOptions {
  launch?: {
    map?: string;
    vconsole?: boolean;
    language?: DotaLanguage;
    args?: string[];
  };
}

export default class LaunchCommand extends CommandGroup {
  public register() {
    this.command({
      command: 'launch',
      describe: 'Launch Dota 2 Workshop Tools.',
      handler: () => this.run(),
    });
  }

  private async run() {
    const win64 = path.join(await this.getDotaPath(), 'game', 'bin', 'win64');
    const args = ['-tools', '-addon', await this.getAddonName()];
    const spawnOptions: SpawnOptions = { cwd: win64, detached: true, stdio: 'ignore' };

    let launchOptions = (await this.getOptions()).launch;
    if (launchOptions == null) launchOptions = {};

    if (launchOptions.vconsole !== false) {
      args.push('-vconsole');
      spawn(path.join(win64, 'vconsole2.exe'), [], spawnOptions).unref();
    }

    if (launchOptions.language != null) args.push('-language', launchOptions.language);
    if (launchOptions.args != null) args.push(...launchOptions.args);
    if (launchOptions.map != null) {
      args.push(`+dota_launch_custom_game ${await this.getAddonName()} ${launchOptions.map}`);
    }

    spawn(path.join(win64, 'dota2.exe'), args, spawnOptions).unref();
  }
}
