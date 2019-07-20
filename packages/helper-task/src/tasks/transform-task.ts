import _ from 'lodash';
import PQueue from 'p-queue';
import { WatchEvent } from '../helper';
import { Task, TaskError, TaskState } from './task';

type TransformWatchEvent = WatchEvent | { event: 'synthetic'; file: string };

export abstract class TransformTask<T> extends Task<T> {
  protected abstract pattern: string | string[];
  private readonly syntheticChanges = new Set<string>();
  private readonly queue = new PQueue();

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, async () => {
      await this.beforeWatch(true);

      const files = await this.matchFiles(this.pattern);
      await Promise.all(files.map(f => this.transformFile(f)));
      await this.afterWatch(true);

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

  protected async transformFile(_filePath: string): Promise<void> {}
  protected async removeFile(_filePath: string): Promise<void> {}
  protected async beforeWatch(_initial: boolean): Promise<void> {}
  protected async afterWatch(_initial: boolean): Promise<void> {}

  private addEventToStack(info: TransformWatchEvent) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    if (this.state !== TaskState.Working) this.watchCycle();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.queue.add(() => this.processWatchEvent(info));
  }

  private async watchCycle() {
    this.removeErrors();
    this.start();
    this.currentCycleFiles.clear();

    await this.beforeWatch(false);
    await this.queue.onIdle();

    // Restore errors coming from not changed files
    for (const [file, errors] of this.watchEventErrors) {
      if (!this.currentCycleFiles.has(file)) {
        this.errors = [...this.errors, ...errors];
      }
    }

    await this.afterWatch(false);

    this.finish();
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
        await this.transformFile(file);
        break;
      case 'unlink':
        await this.removeFile(file);
        break;
    }
    this.watchEventErrors.set(file, _.difference(this.errors, oldErrors));
  }
}
