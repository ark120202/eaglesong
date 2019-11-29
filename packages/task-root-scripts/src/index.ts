import { Task } from '@eaglesong/helper-task';
import path from 'path';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { Worker } from 'worker_threads';
import { Message, WorkerData } from './worker';

export default class RootScriptsTask extends Task<void> {
  constructor() {
    super(undefined);
  }

  public apply() {
    this.hooks.build.tap(this.constructor.name, () => {
      const workerData: WorkerData = {
        currentDirectory: this.context,
        isWatching: this.isWatching,
        configPath: this.resolvePath('project', 'tsconfig.json'),
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
