import { Task, TaskState } from '@eaglesong/helper-task';
import _ from 'lodash';
import PQueue from 'p-queue';

export interface AddonInfoMap {
  MaxPlayers: number;
  TeamCount: number;
}

export interface DefaultKey {
  Key: string;
  Command: string;
  Name: string;
}

// FIXME: check
export interface Options {
  /**
   * Enables check for AFK / Fountain idling players.
   *
   * Disabled by default.
   */
  CheckAFKPlayers?: boolean;
  /**
   * Enables leave penalties.
   *
   * Disabled by default.
   */
  PenaltiesEnabled?: boolean;
  /** Enabled by default. */
  HeroGuidesSupported?: boolean;
  /** Enabled by default. */
  ShouldForceDefaultGuide?: boolean;
  /**
   * Enables ban phase.
   *
   * Disabled by default.
   */
  EnablePickRules?: boolean;
  /**
   * Binds keys to console commands.
   *
   * Prefer to use `Game.CreateCustomKeyBind` whenever possible.
   */
  Default_Keys?: DefaultKey[];
}

export default class AddonInfoTask extends Task<Options> {
  private readonly queue = new PQueue({ concurrency: 1 });
  private maps: Record<string, AddonInfoMap> = {};

  constructor(options: Options = {}) {
    super(options);
  }

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, () => this.queueEmit());
  }

  public setMaps(maps: Record<string, AddonInfoMap>) {
    this.maps = maps;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.queueEmit();
  }

  private async queueEmit() {
    return this.queue.add(async () => {
      if (this.state !== TaskState.Working) this.start();
      await Promise.resolve();
      await this.emit();
      this.finish();
    });
  }

  private async emit() {
    const content: Record<string, any> = {
      maps: Object.keys(this.maps).join(' '),
      ...this.maps,
    };

    (Object.keys(this.options) as (keyof Options)[]).forEach(key => {
      if (key === 'Default_Keys' && this.options.Default_Keys != null) {
        content.Default_Keys = _.fromPairs(
          // TODO: as const
          this.options.Default_Keys.map((k, i): [string, DefaultKey] => [String(i + 1), k]),
        );
        return;
      }

      const value = this.options[key];
      if (value != null) content[key] = value ? '1' : '0';
    });

    if (this.dotaPath == null) return;
    await this.outputKV1(this.resolvePath('game', 'addoninfo.txt'), { '': content });
  }
}
