import { Task } from '@eaglesong/helper-task';
import fs from 'fs-extra';

export interface Options {
  materials?: boolean;
  models?: boolean;
  particles?: boolean;
}

const DEFAULT_OPTIONS: Options = {
  materials: true,
  models: true,
  particles: true,
};

export default class ResourcesTask extends Task<Options> {
  private enabledDirectories!: string[];
  constructor(options: Options = {}) {
    super(options);
  }

  public apply() {
    this.enabledDirectories = Object.entries({ ...DEFAULT_OPTIONS, ...this.options })
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    this.hooks.build.tapPromise(this.constructor.name, () => this.makeSymlinks());
    this.hooks.compile.tap(this.constructor.name, addResource =>
      addResource(this.enabledDirectories.map(x => `${x}/**/*.{vmat,vtex,vmdl,vpcf}`)),
    );
  }

  private async makeSymlinks() {
    if (this.dotaPath != null) {
      await Promise.all(
        this.enabledDirectories.map(d => fs.ensureDir(this.resolvePath(`src/${d}`))),
      );

      await Promise.all(
        this.enabledDirectories.map(x =>
          fs.ensureSymlink(this.resolvePath(`src/${x}`), this.resolvePath('content', x)),
        ),
      );
    }

    this.finish();
  }
}
