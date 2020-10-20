import fs from 'fs-extra';
import { Task } from '../../helper';

export default class AddonDirectoriesTask extends Task<void> {
  public apply() {
    if (this.dotaPath == null) return;

    this.hooks.build.tap(this.constructor.name, () => {
      for (const name of ['game', 'content'] as const) {
        const dotaPath = this.resolvePath(name, '');
        const symlinkPath = this.resolvePath(`.eaglesong/${name}`);
        fs.ensureDirSync(dotaPath);
        fs.ensureSymlinkSync(dotaPath, symlinkPath);
      }

      this.finish();
    });
  }
}
