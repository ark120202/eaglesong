import { NamedType, ServiceErrorReporter, TaskProvider } from '@eaglesong/helper-task';
import * as s from 'dota-data/lib/schema';
import { schemas as standardSchemas } from 'dota-data/lib/schemas';
import { resourcePatterns } from 'dota-data/lib/schemas/resources';
import _ from 'lodash';
import pProps from 'p-props';
import { AsyncSeriesHook } from 'tapable';
import path from 'upath';
import { Plugin, PluginApi } from './plugin';

export type Schemas = Record<string, s.RootSchema>;

export type File = Record<string, any> & NamedType;
export type Files = Record<string, File> & NamedType;
export type FileGroups = Record<string, Files> & NamedType;

export type Hooks = ScriptsService['hooks'] & NamedType;

const scriptDirectories = ['items', 'npc', 'shops'];
function getScriptGroup(fileName: string) {
  const segments = fileName.split('/');
  let groupName =
    segments.length > 1 && scriptDirectories.includes(segments[0])
      ? `${segments[0]}/${segments[1]}`
      : segments[0];

  if (groupName === fileName) {
    groupName = path.trimExt(groupName);
  }

  return groupName;
}

function getDefaultSchemas(): Record<string, s.RootSchema> {
  const schemas = _.mapKeys(_.cloneDeep(standardSchemas), (_value, key) => `npc/${key}`);

  schemas.custom_net_tables = s
    .root()
    .field('custom_net_tables', s.array(s.str()), { require: true });

  schemas.shops = s
    .root()
    .rest(s.obj('Shop').field('item', s.str().pattern(resourcePatterns.item)));

  return schemas;
}

export class ScriptsService {
  public hooks = {
    schemas: new AsyncSeriesHook<[Schemas]>(['schemas']),

    transform: new AsyncSeriesHook<[Files, string]>(['files', 'group']),

    emit: new AsyncSeriesHook<[File, string]>(['file', 'group']),

    // TODO:
    migrate: new AsyncSeriesHook<[Files, string]>(['files', 'group']),
  };

  constructor(
    context: string,
    plugins: Plugin[],
    taskProvider: TaskProvider,
    private readonly error: ServiceErrorReporter,
  ) {
    this.hooks.schemas.tap({ name: 'ScriptsService', stage: -1000 }, (schemas) => {
      Object.assign(schemas, getDefaultSchemas());
    });

    const collectedSchemas: Schemas = {};
    this.hooks.schemas.tap({ name: 'ScriptsService', stage: 1000 }, (schemas) => {
      Object.assign(collectedSchemas, schemas);
    });

    const api: PluginApi = {
      hooks: this.hooks,
      taskProvider,
      error,
      context,
      collectedSchemas,
    };

    plugins.forEach((p) => p(api));
  }

  private groups: FileGroups = {};
  public addFile(fileName: string, fileContent: File) {
    const group = getScriptGroup(fileName);

    if (this.groups[group] == null) this.groups[group] = {};
    this.groups[group][fileName] = fileContent;
  }

  public removeFile(fileName: string) {
    const group = getScriptGroup(fileName);

    if (this.groups[group]?.[fileName] == null) return;
    delete this.groups[group][fileName];
    if (Object.keys(this.groups[group]).length === 0) delete this.groups[group];
  }

  public removeAllFiles() {
    this.groups = {};
  }

  public async emit(): Promise<Files> {
    const packedGroups = await pProps(this.groups, async (files, group) => {
      const file = await this.transform(files, group);
      await this.hooks.emit.promise(file, group);

      return file;
    });

    return packedGroups;
  }

  private async transform(files: Files, group: string): Promise<File> {
    files = _.cloneDeep(files);
    await this.hooks.transform.promise(files, group);

    const keyCache: Record<string, string[]> = {};
    _.each(files, (file, fileName) =>
      Object.keys(file).forEach((key) => {
        if (keyCache[key] == null) keyCache[key] = [];
        keyCache[key].push(fileName);
      }),
    );

    for (const [key, fileList] of Object.entries(keyCache)) {
      if (fileList.length > 1) {
        const definedIn = `[${fileList.join(', ')}]`;
        this.error({
          message: `Key '${key}' is defined in ${definedIn}, only one definition is allowed.`,
        });
      }
    }

    return Object.assign({}, ...Object.values(files));
  }
}
