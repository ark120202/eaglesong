import { Task } from '@eaglesong/helper-task';
import AddonInfoTask from '@eaglesong/task-addoninfo';
import fs from 'fs-extra';
import _ from 'lodash';
import PQueue from 'p-queue';
import path from 'upath';
import { MapsMetadata, metadataSchema, validateMetadata } from './metadata';

export default class MapsTask extends Task<void> {
  private readonly queue = new PQueue({ concurrency: 1 });
  private mapsPath!: string;
  private metadataPath!: string;
  private addonInfoTask!: AddonInfoTask;

  constructor() {
    super(undefined);
  }

  public apply() {
    const addonInfoTask = this.taskProvider(AddonInfoTask);
    if (addonInfoTask == null) throw new Error('MapsTask requires AddonInfoTask');
    this.addonInfoTask = addonInfoTask;

    this.mapsPath = this.resolvePath('src/maps');
    this.metadataPath = this.resolvePath('src/maps/metadata.yml');

    this.hooks.preBuild.tapPromise(this.constructor.name, async () => {
      const schemaPath = this.resolvePath('.eaglesong/schemas/maps-metadata.json');
      await fs.outputJson(schemaPath, metadataSchema, { spaces: 2 });
    });

    this.hooks.build.tapPromise(this.constructor.name, async () => {
      await fs.ensureDir(this.mapsPath);
      if (this.dotaPath != null) {
        await fs.ensureSymlink(this.mapsPath, this.resolvePath('content', 'maps'));
        await fs.ensureSymlink(
          this.resolvePath('src/maps/overviews'),
          this.resolvePath('game', 'resource/overviews'),
        );
      }

      await this.reloadMetadata();

      this.watch([this.mapsPath, 'src/materials/overviews'], () => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.queue.add(async () => {
          this.removeErrors();
          this.start();
          await this.reloadMetadata();
        });
      });
    });

    this.hooks.compile.tap(this.constructor.name, addResource => addResource('maps/*.vmap'));
  }

  private async reloadMetadata() {
    const maps = await this.import(this.metadataPath);
    // Parsing error
    if (this.getErrorLevel() != null) {
      this.finish();
      return;
    }

    this.validateMetadata(maps);
    if (this.getErrorLevel() != null) {
      this.finish();
      return;
    }

    await this.validateMaps(maps);
    await this.validateOverviews(maps);

    if (this.getErrorLevel() == null) {
      this.addonInfoTask.setMaps({ ...maps, maps: Object.keys(maps).join(' ') });
    } else {
      this.addonInfoTask.setMaps({});
    }

    this.finish();
  }

  private validateMetadata(maps: MapsMetadata) {
    const valid = validateMetadata(maps);
    if (!valid && validateMetadata.errors != null) {
      for (const { dataPath, message } of validateMetadata.errors) {
        this.error({ filePath: this.metadataPath, message: `${dataPath} ${message}` });
      }
    }
  }

  private async validateMaps(maps: MapsMetadata) {
    for (const mapName of Object.keys(maps)) {
      const filePath = this.resolvePath(`src/maps/${mapName}.vmap`);
      if (!(await fs.pathExists(filePath))) {
        this.error({ filePath, message: 'Referenced map file not found' });
      }
    }
  }

  private async validateOverviews(maps: MapsMetadata) {
    const mapNames = Object.keys(maps);
    const compare = async (directory: string, extensions: string[]) => {
      const expected = mapNames.flatMap(n => extensions.map(e => path.join(directory, n) + e));
      const actual = (await fs.readdir(directory)).map(name => path.join(directory, name));
      return {
        extra: _.difference(actual, expected),
        missing: _.difference(expected, actual),
      };
    };

    const diff = await Promise.all([
      compare(this.resolvePath('src/maps/overviews'), ['.txt']),
      // TODO: Require only files referenced in .txt files
      compare(this.resolvePath('src/materials/overviews'), ['.tga', '.txt', '.vmat']),
    ]);

    diff
      .flatMap(x => x.extra)
      .forEach(filePath => this.error({ filePath, message: 'Map overview file should not exist' }));

    diff
      .flatMap(x => x.missing)
      .forEach(filePath => this.error({ filePath, message: 'Map overview file not found' }));
  }
}
