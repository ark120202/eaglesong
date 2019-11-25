import { schemas as standardSchemas } from '@dota-data/scripts';
import { RootSchema } from '@dota-data/scripts/lib/schema';
import {
  NamedType,
  ServiceErrorReporter,
  ServicePluginApi,
  TaskProvider,
} from '@eaglesong/helper-task';
import _ from 'lodash';
import pProps from 'p-props';
import { AsyncSeriesHook } from 'tapable';
import path from 'upath';

export type Plugin = (api: PluginApi) => void;
export type PluginApi = ServicePluginApi & { hooks: Hooks; collectedSchemas: Schemas };
export type Schemas = Record<string, RootSchema>;

export type File = Record<string, any> & NamedType;
export type Files = Record<string, File> & NamedType;
export type FileGroups = Record<string, Files> & NamedType;

export type Hooks = NpcService['hooks'] & NamedType;

function getGroupFromFileName(fileName: string): string {
  const segments = fileName.split('/');
  return segments.length === 1 ? path.parse(fileName).name : segments[0];
}

export class NpcService {
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
    this.hooks.schemas.tap({ name: 'NpcService', stage: -1000 }, schemas => {
      Object.assign(schemas, _.cloneDeep(standardSchemas));
    });

    const collectedSchemas: Schemas = {};
    this.hooks.schemas.tap({ name: 'NpcService', stage: 1000 }, schemas => {
      Object.assign(collectedSchemas, schemas);
    });

    const api: PluginApi = {
      hooks: this.hooks,
      taskProvider,
      error,
      context,
      collectedSchemas,
    };

    plugins.forEach(p => p(api));
  }

  private groups: FileGroups = {};
  public addFile(fileName: string, fileContent: File) {
    const group = getGroupFromFileName(fileName);

    if (this.groups[group] == null) this.groups[group] = {};
    this.groups[group][fileName] = fileContent;
  }

  public removeFile(fileName: string) {
    const group = getGroupFromFileName(fileName);

    if (this.groups[group] == null || this.groups[group][fileName] == null) return;
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
      Object.keys(file).forEach(key => {
        if (keyCache[key] == null) keyCache[key] = [];
        keyCache[key].push(fileName);
      }),
    );

    for (const [key, fileList] of Object.entries(keyCache)) {
      if (fileList.length > 1) {
        const definedIn = fileList.length === 1 ? `'${fileList[0]}'` : `[${fileList.join(', ')}]`;
        this.error({
          message: `Key ${key} is defined in ${definedIn}, yet only one definition is allowed.`,
        });
      }
    }

    return Object.assign({}, ...Object.values(files));
  }
}
