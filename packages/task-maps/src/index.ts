import { Task } from '@eaglesong/helper-task';
import AddonInfoTask, { AddonInfoMap } from '@eaglesong/task-addoninfo';
import Ajv from 'ajv';
import fs from 'fs-extra';
import _ from 'lodash';
import PQueue from 'p-queue';
import path from 'path';
import validFilename from 'valid-filename';
import { MapsMetadata, schema } from './metadata.schema';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
const compiledSchema = ajv.compile(schema);

interface MapCombination {
  base: string;
  modification: string;
  name: string;

  teams: number;
  players: number;
}

async function safeSymlink(srcpath: string, dstpath: string) {
  try {
    const real = await fs.realpath(dstpath);
    if (real === srcpath) return;
    if (real === dstpath) throw new Error(`${dstpath} already exists`);
    await fs.remove(dstpath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await fs.ensureSymlink(srcpath, dstpath);
}

export default class MapsTask extends Task<void> {
  private readonly queue = new PQueue({ concurrency: 1 });
  private mapsPath!: string;
  private metadataPath!: string;
  private mapsMetadata?: Required<MapsMetadata>;
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

    this.hooks.build.tapPromise(this.constructor.name, async () => {
      await fs.ensureDir(this.mapsPath);
      if (this.dotaPath != null) {
        await fs.ensureSymlink(this.mapsPath, this.resolvePath('content', 'maps'));
      }

      await this.reloadMetadata();

      const watchedResources = [
        this.metadataPath,
        'src/maps/bases',
        'src/maps/overviews',
        'src/materials/overviews',
      ];

      this.watch(watchedResources, () => {
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
    this.mapsMetadata = undefined;
    const content = await this.import(this.metadataPath);
    // Parsing error
    if (this.errorLevel != null) {
      this.finish();
      return;
    }

    const valid = compiledSchema(content);
    if (!valid && compiledSchema.errors != null) {
      for (const { message, dataPath } of compiledSchema.errors) {
        this.error(this.metadataPath, `metadata${dataPath} ${message}`);
      }

      this.finish();
      return;
    }

    // Defaults are applied
    this.mapsMetadata = content as Required<MapsMetadata>;
    this.validateMetadata();
    await this.validateFiles();
    await this.removeOldMapLinks();

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.errorLevel == null) {
      await this.syncOverviews();
      await this.createMapLinks();

      this.addonInfoTask.setMaps(
        _.fromPairs(
          this.getSortedMapCombinations().map(({ name, players, teams }): [
            string,
            AddonInfoMap,
          ] => [name, { MaxPlayers: players, TeamCount: teams }]),
        ),
      );
    } else {
      this.mapsMetadata = undefined;
      this.addonInfoTask.setMaps({});
    }

    this.finish();
  }

  private async syncOverviews() {
    await this.moveAndUnlinkOverviews();
    await this.validateOverviewSources();
    if (this.errorLevel == null) await this.linkOverviews();
  }

  private async linkOverviews() {
    if (this.dotaPath == null) return;
    const maps = this.getMapCombinations();
    const src = this.resolvePath('src/maps/overviews');
    const resource = this.resolvePath('game', 'resource/overviews');

    await Promise.all(
      maps.map(({ base, name }) =>
        safeSymlink(path.join(src, `${base}.txt`), path.join(resource, `${name}.txt`)),
      ),
    );
  }

  private async moveAndUnlinkOverviews() {
    if (this.dotaPath == null) return;
    const maps = this.getMapCombinations();
    const src = this.resolvePath('src/maps/overviews');
    const resource = this.resolvePath('game', 'resource/overviews');

    if (!(await fs.pathExists(resource))) return;

    const resourceFiles = await fs.readdir(resource);
    await Promise.all(
      resourceFiles.map(async fileName => {
        const filePath = path.join(resource, fileName);
        const stats = await fs.lstat(filePath);
        if (stats.isSymbolicLink()) {
          if (!maps.some(({ name }) => `${name}.txt` === fileName)) await fs.remove(filePath);
        } else {
          await fs.move(path.join(resource, fileName), path.join(src, fileName));
        }
      }),
    );
  }

  private async validateOverviewSources() {
    const src = this.resolvePath('src/maps/overviews');
    const materials = this.resolvePath('src/materials/overviews');

    const baseNames = Object.keys(this.mapsMetadata!.maps);
    const compare = async (directory: string, extensions: string[]) => {
      // TODO: Clean up
      const expected = _.flatMap(baseNames.map(x => path.join(directory, x)), n =>
        extensions.map(e => n + e),
      );
      const actual = (await fs.readdir(directory)).map(name => path.join(directory, name));
      return {
        extra: _.difference(actual, expected),
        missing: _.difference(expected, actual),
      };
    };

    const diff = await Promise.all([
      compare(src, ['.txt']),
      compare(materials, ['.tga', '.txt', '.vmat']),
    ]);

    _.flatMap(diff, x => x.extra).forEach(p => this.error(p, 'Map overview file should not exist'));
    _.flatMap(diff, x => x.missing).forEach(p => this.error(p, 'Map overview file not found'));
  }

  private async createMapLinks() {
    if (this.mapsMetadata == null) return;
    await Promise.all(
      this.getMapCombinations().map(c =>
        safeSymlink(
          path.join(this.mapsPath, `bases/${c.base}.vmap`),
          path.join(this.mapsPath, `${c.name}.vmap`),
        ),
      ),
    );
  }

  private async removeOldMapLinks() {
    const mapNames = this.getMapCombinations().map(m => m.name);
    const existingMaps = await fs.readdir(this.mapsPath);
    await Promise.all(
      existingMaps.map(async mapFileName => {
        if (!mapFileName.endsWith('.vmap')) return;
        const mapPath = path.join(this.mapsPath, mapFileName);
        const mapName = path.parse(mapFileName).name;
        const stats = await fs.lstat(mapPath);
        if (stats.isSymbolicLink()) {
          if (!mapNames.includes(mapName)) await fs.remove(mapPath);
        } else {
          this.error(
            mapPath,
            '"maps" directory should not contain any .vmap files, except generated by Eaglesong',
          );
        }
      }),
    );
  }

  private async validateFiles() {
    if (this.mapsMetadata == null) return;

    const baseNames = Object.keys(this.mapsMetadata.maps);
    const basesPath = this.resolvePath('src/maps/bases');

    const expected = baseNames.map(x => path.join(basesPath, `${x}.vmap`));
    const actual = (await fs.readdir(basesPath)).map(name => path.join(basesPath, name));

    const extra = _.difference(actual, expected);
    const missing = _.difference(expected, actual);
    extra.forEach(p => this.error(p, 'Map base file should not exist'));
    missing.forEach(p => this.error(p, 'Map base file not found'));
  }

  private validateMetadata() {
    if (this.mapsMetadata == null) return;
    const mapNames = this.getMapCombinations().map(m => m.name);
    const { order } = this.mapsMetadata;

    Object.keys(this.mapsMetadata.maps)
      .filter(m => !validFilename(m))
      .forEach(m => this.error(this.metadataPath, `Map group "${m}" is invalid file name`));

    mapNames
      .filter(m => !validFilename(m))
      .forEach(m => this.error(this.metadataPath, `Map "${m}" is invalid file name`));

    Object.entries(_.countBy(mapNames))
      .filter(([, n]) => n > 1)
      .forEach(([m, n]) => this.error(this.metadataPath, `Map "${m}" appears ${n} times.`));

    order
      .filter(m => m !== '...' && !mapNames.includes(m))
      .forEach(m => this.error(this.metadataPath, `Order member "${m}" is invalid map name`));

    if (order.includes('...')) {
      if (mapNames.every(n => order.includes(n))) {
        this.error(
          this.metadataPath,
          'Rest map order element is unnecessary, all map names are specified',
        );
      }

      return;
    }

    mapNames
      .filter(m => !order.includes(m))
      .forEach(m =>
        this.error(
          this.metadataPath,
          `Can't determine order for map "${m}".` +
            "Explicitly specify it under 'order' or add '...' rest element.",
        ),
      );
  }

  private getSortedMapCombinations() {
    if (this.mapsMetadata == null) throw new Error('No metadata');
    const maps = this.getMapCombinations();
    const mapNames = maps.map(m => m.name);
    const { order } = this.mapsMetadata;

    const restMaps = mapNames.filter(n => !order.includes(n));
    const sortedNames = _.flatMap(order, x => (x !== '...' ? x : restMaps));
    return _.sortBy(maps, m => sortedNames.indexOf(m.name));
  }

  private getMapCombinations() {
    if (this.mapsMetadata == null) throw new Error('No metadata');
    const { maps, separator } = this.mapsMetadata;

    return _.flatMap(maps, ({ modifications, players, teams }, base) =>
      modifications!.map(
        (modification): MapCombination => ({
          base,
          modification,
          name: base + (modification === '_' ? '' : separator + modification),
          teams,
          players,
        }),
      ),
    );
  }
}
