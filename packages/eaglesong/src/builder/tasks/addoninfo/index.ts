import PQueue from 'p-queue';
import { Task, TaskState } from '../../helper';
// FIXME: check
import { DefaultKey, Options } from './options';

export { DefaultKey, Options };

export default class AddonInfoTask extends Task<Options> {
  constructor(options: Options = {}) {
    super(options);
  }

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, () => this.queueEmit());
  }

  private maps: Record<string, any> = {};
  public setMaps(maps: Record<string, any>) {
    this.maps = maps;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.queueEmit();
  }

  private readonly queue = new PQueue({ concurrency: 1 });
  private async queueEmit() {
    return this.queue.add(async () => {
      if (this.state !== TaskState.Working) this.start();
      await Promise.resolve();
      await this.emit();
      this.finish();
    });
  }

  private async emit() {
    if (this.dotaPath == null) return;

    const content: Record<string, any> = { ...this.maps };

    for (const [key, value] of Object.entries(this.options)) {
      if (value == null) return;

      if (key === 'Default_Keys') {
        content[key] = Object.fromEntries(
          (value as DefaultKey[]).map((k, i) => [String(i + 1), k]),
        );
      } else {
        content[key] = value ? '1' : '0';
      }
    }

    await this.outputKV1(this.resolvePath('game', 'addoninfo.txt'), { '': content });
  }
}
