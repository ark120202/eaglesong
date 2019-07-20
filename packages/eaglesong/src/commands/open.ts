import fs from 'fs-extra';
import open from 'open';
import path from 'upath';
import { CommandGroup } from '../command';

export default class OpenCommand extends CommandGroup {
  public register() {
    this.command({
      command: 'open <game|content>/...',
      describe: 'Open addon directory',
      handler: async args => {
        const query: string = args.game;
        const [from, ...components] = query.split(/[/\\]/g);
        if (from !== 'game' && from !== 'content') {
          throw new Error(`Unknown open argument: ${from}`);
        }

        const dotaPath = await this.getDotaPath();
        const addonName = await this.getAddonName();
        const requestedPath = path.join(dotaPath, from, 'dota_addons', addonName, ...components);

        if (!(await fs.pathExists(requestedPath))) {
          throw new Error(`Path not exists: ${requestedPath}`);
        }

        if (!(await fs.stat(requestedPath)).isDirectory()) {
          throw new Error(`Path is not a directory: ${requestedPath}`);
        }

        await open(requestedPath);
      },
    });
  }
}
