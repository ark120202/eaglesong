import fs from 'fs-extra';
import path from 'path';
import { Worker } from 'worker_threads';
import { Task } from '../../helper';
import { Message, WorkerData } from './worker';

const tstlPath = path.dirname(require.resolve('typescript-to-lua/package.json'));
const copyLuaLib = (to: string) =>
  fs.copy(path.join(tstlPath, 'dist/lualib/lualib_bundle.lua'), path.join(to, 'lualib_bundle.lua'));

export default class VScriptsTask extends Task<void> {
  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, async () => {
      let outDir: string | undefined;
      if (this.dotaPath != null) {
        outDir = this.resolvePath('game', 'scripts/vscripts');
        await copyLuaLib(outDir);
      }

      const workerData: WorkerData = {
        currentDirectory: this.resolvePath('src/vscripts'),
        configPath: this.resolvePath('src/vscripts/tsconfig.json'),
        isWatching: this.isWatching,
        outDir,
        hasDota: this.dotaPath != null,
      };

      const worker = new Worker(path.join(__dirname, 'worker.js'), { workerData });
      worker.on('message', (message: Message) => {
        switch (message.type) {
          case 'start':
            this.removeErrors();
            this.start();
            break;

          case 'end':
            message.errors.forEach(this.error);
            this.finish();
            break;
        }
      });
    });
  }
}
