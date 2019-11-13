import del from 'del';
import path from 'upath';
import { CommandGroup } from '../command';

export default class CleanCommand extends CommandGroup {
  public register() {
    this.command({
      command: 'clean',
      describe: 'Remove all addon files outside of project directory',
      handler: () => this.run(),
    });
  }

  public async run() {
    const dotaPath = await this.getDotaPath();
    const addonName = await this.getAddonName();
    const game = path.join(dotaPath, 'game', 'dota_addons', addonName);
    const content = path.join(dotaPath, 'content', 'dota_addons', addonName);

    const removed = await del([game, content], { force: true });
    if (removed.length === 0) {
      console.log('No addon directories found');
      return;
    }

    const gameRemoved = removed.includes(game);
    const message = removed.length === 2 ? 'Game and content' : gameRemoved ? 'Game' : 'Content';
    const directoryMessage = removed.length === 1 ? 'directory' : 'directories';
    console.log(`${message} addon ${directoryMessage} successfully removed`);
  }
}
