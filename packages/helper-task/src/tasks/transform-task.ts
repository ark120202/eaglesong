import _ from 'lodash';
import PQueue from 'p-queue';
import { WatchEvent } from '../helper';
import { Task, TaskError, TaskState } from './task';

export abstract class TransformTask<T> extends Task<T> {
  protected abstract pattern: string | string[];
  private readonly queue = new PQueue({ autoStart: false });

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, async () => {
      if (this.beforeWatch) await this.beforeWatch(true);

      const files = await this.matchFiles(this.pattern);
      if (this.transformFile) await Promise.all(files.map((f) => this.transformFile!(f)));
      if (this.afterWatch) await this.afterWatch(true);

      this.finish();
      this.watch(this.pattern, (e) => this.addEventToStack(e));
    });
  }

  protected transformFile?(_filePath: string): void | Promise<void>;
  protected removeFile?(_filePath: string): void | Promise<void>;
  protected beforeWatch?(_initial: boolean): void | Promise<void>;
  protected afterWatch?(_initial: boolean): void | Promise<void>;

  private addEventToStack(event: WatchEvent) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.queue.add(() => this.processWatchEvent(event));
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    if (this.state !== TaskState.Working) this.startWatchCycle();
  }

  private async startWatchCycle() {
    this.removeErrors();
    this.start();
    this.currentCycleFiles.clear();

    if (this.beforeWatch) await this.beforeWatch(false);
    this.queue.start();
    await this.queue.onIdle();
    this.queue.pause();

    // Restore errors coming from not changed files
    for (const [file, errors] of this.watchEventErrors) {
      if (!this.currentCycleFiles.has(file)) {
        this.errors = [...this.errors, ...errors];
      }
    }

    if (this.afterWatch) await this.afterWatch(false);

    this.finish();

    if (this.queue.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.startWatchCycle();
    }
  }

  private readonly watchEventErrors = new Map<string, TaskError[]>();
  private readonly currentCycleFiles = new Set<string>();
  private async processWatchEvent({ event, file }: WatchEvent) {
    this.currentCycleFiles.add(file);
    this.watchEventErrors.delete(file);
    const oldErrors = [...this.errors];
    switch (event) {
      case 'add':
      case 'change':
        if (this.transformFile) await this.transformFile(file);
        break;
      case 'unlink':
        if (this.removeFile) await this.removeFile(file);
        break;
    }

    this.watchEventErrors.set(file, _.difference(this.errors, oldErrors));
  }
}
