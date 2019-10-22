import _ from 'lodash';
import PQueue from 'p-queue';
import { WatchEvent } from '../helper';
import { Task, TaskError, TaskState } from './task';

type TransformWatchEvent = WatchEvent | { event: 'synthetic'; file: string };

export abstract class TransformTask<T> extends Task<T> {
  protected abstract pattern: string | string[];
  private readonly syntheticChanges = new Set<string>();
  private readonly queue = new PQueue({ autoStart: false });

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, async () => {
      if (this.beforeWatch) await this.beforeWatch(true);

      const files = await this.matchFiles(this.pattern);
      if (this.transformFile) await Promise.all(files.map(f => this.transformFile!(f)));
      if (this.afterWatch) await this.afterWatch(true);

      this.finish();
      this.watch(this.pattern, e => this.addEventToStack(e));
    });
  }

  protected triggerChange(file: string) {
    if (this.syntheticChanges.has(file)) return;
    this.syntheticChanges.add(file);
    this.addEventToStack({ event: 'synthetic', file });
    setImmediate(() => this.syntheticChanges.delete(file));
  }

  protected transformFile?(_filePath: string): void | Promise<void>;
  protected removeFile?(_filePath: string): void | Promise<void>;
  protected beforeWatch?(_initial: boolean): void | Promise<void>;
  protected afterWatch?(_initial: boolean): void | Promise<void>;

  private addEventToStack(info: TransformWatchEvent) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.queue.add(() => this.processWatchEvent(info));
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
  private async processWatchEvent({ event, file }: TransformWatchEvent) {
    this.currentCycleFiles.add(file);
    this.watchEventErrors.delete(file);
    const oldErrors = [...this.errors];
    switch (event) {
      case 'add':
      case 'change':
      case 'synthetic':
        if (this.transformFile) await this.transformFile(file);
        break;
      case 'unlink':
        if (this.removeFile) await this.removeFile(file);
        break;
    }

    this.watchEventErrors.set(file, _.difference(this.errors, oldErrors));
  }
}
