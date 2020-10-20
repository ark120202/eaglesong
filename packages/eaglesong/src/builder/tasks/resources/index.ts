import fs from 'fs-extra';
import { Task } from '../../helper';

type ResourceTarget = 'game' | 'content';
type OptionValue = ResourceTarget | false;
export type Options = Partial<
  Record<keyof typeof DEFAULT_OPTIONS, OptionValue> & Record<string, OptionValue>
>;

const DEFAULT_OPTIONS = {
  itembuilds: 'game',
  materials: 'content',
  models: 'content',
  particles: 'content',
} as const;

export default class ResourcesTask extends Task<Options> {
  private enabledDirectories!: Record<string, ResourceTarget>;
  constructor(options: Options = {}) {
    super(options);
  }

  public apply() {
    this.enabledDirectories = Object.fromEntries(
      Object.entries({ ...DEFAULT_OPTIONS, ...this.options }).filter(([, kind]) => kind),
    ) as Record<string, ResourceTarget>;

    this.hooks.build.tapPromise(this.constructor.name, () => this.makeSymlinks());
    this.hooks.compile.tap(this.constructor.name, (addResource) => {
      if (this.enabledDirectories.materials === 'content') {
        addResource('materials/**/*.{vmat,vtex}');
      }

      if (this.enabledDirectories.models === 'content') {
        addResource('models/**/*.vmdl');
      }

      if (this.enabledDirectories.particles === 'content') {
        addResource('particles/**/*.vpcf');
      }
    });
  }

  private async makeSymlinks() {
    if (this.dotaPath != null) {
      await Promise.all(
        Object.keys(this.enabledDirectories).map((n) => fs.ensureDir(this.resolvePath(`src/${n}`))),
      );

      await Promise.all(
        Object.entries(this.enabledDirectories).map(([name, kind]) =>
          fs.ensureSymlink(this.resolvePath(`src/${name}`), this.resolvePath(kind, name)),
        ),
      );
    }

    this.finish();
  }
}
