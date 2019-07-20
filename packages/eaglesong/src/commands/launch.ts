import { DotaLanguage } from '@eaglesong/task-localization';
import { spawn } from 'child_process';
import path from 'upath';
import { CommandGroup } from '../command';

export interface LaunchOptions {
  launch?: {
    map?: string | null;
    vconsole?: boolean;
    args?: string[];
    language?: DotaLanguage | null;
  };
}

export default class LaunchCommand extends CommandGroup {
  public register() {
    this.command({
      command: 'launch',
      describe: 'Launch Dota 2 Workshop Tools',
      handler: () => this.launch(),
    });
  }

  private async launch() {
    const win64 = path.join(await this.getDotaPath(), 'game', 'bin', 'win64');
    const args = ['-tools', '-addon', await this.getAddonName()];

    let launchOptions = (await this.getOptions()).launch;
    if (launchOptions == null) launchOptions = {};
    if (launchOptions.vconsole !== false) {
      args.push('-vconsole');
      spawn(path.join(win64, 'vconsole2.exe'), [], { cwd: win64 });
    }
    if (launchOptions.language != null) args.push('-language', launchOptions.language);
    if (launchOptions.args != null) args.push(...launchOptions.args);
    if (launchOptions.map != null) {
      args.push(`+dota_launch_custom_game ${await this.getAddonName()} ${launchOptions.map}`);
    }

    spawn(path.join(win64, 'dota2.exe'), args, { cwd: win64 });
  }
}
