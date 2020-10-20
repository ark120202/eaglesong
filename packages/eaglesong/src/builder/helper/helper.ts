import assert from 'assert';
import chokidar from 'chokidar';
import fs from 'fs-extra';
import globby from 'globby';
import { AsyncParallelHook } from 'tapable';
import path from 'upath';
import vdf from 'vdf-extra';
import { NamedType } from './service';
import { ReadonlyTaskMap, TaskProvider } from './tasks';
import { _import } from './utils';

export interface OutputOptions extends vdf.StringifyOptions {
  header?: boolean | string | ((filePath: string) => string | undefined);
}

const DEFAULT_HEADER = `This file is generated by Eaglesong.
Don't edit it manually. All your changes will be lost.`;

export const getOutputHeader = ({ header = true }: OutputOptions, filePath: string) =>
  typeof header === 'function'
    ? header(filePath)
    : header === true
    ? DEFAULT_HEADER
    : header === false
    ? undefined
    : header;

export interface WatchEvent {
  event: 'add' | 'change' | 'unlink';
  file: string;
}

export const createHooks = (): Hooks => createHooksInternal();
export type Hooks = ReturnType<typeof createHooksInternal> & NamedType;
const createHooksInternal = () => ({
  boot: new AsyncParallelHook<[]>([]),

  preBuild: new AsyncParallelHook<[]>([]),

  build: new AsyncParallelHook<[]>([]),

  compile: new AsyncParallelHook<[(patterns: string | string[]) => void]>(['addResource']),
});

export class BuildHelper {
  constructor(
    public readonly context: string,
    public readonly dotaPath: string | undefined,
    public readonly addonName: string,
    public readonly outputOptions: OutputOptions,
    public readonly hooks: Readonly<Hooks>,
    private readonly tasks: ReadonlyTaskMap,
    public readonly isWatching: boolean,
    private readonly flags: Record<string, boolean | undefined>,
  ) {}

  public async matchFiles(patterns: string | string[]) {
    return (await globby(patterns, { cwd: this.context, absolute: true })).map(path.toUnix);
  }

  public watch(patterns: string | string[], callback: (info: WatchEvent) => void) {
    if (!this.isWatching) return;

    const toPath = (fileName: string) => path.resolve(this.context, fileName);
    const watcher = chokidar.watch(patterns, {
      ignoreInitial: true,
      cwd: this.context,
      awaitWriteFinish: { stabilityThreshold: 200 },
    });

    watcher.on('add', (file) => callback({ event: 'add', file: toPath(file) }));
    watcher.on('change', (file) => callback({ event: 'change', file: toPath(file) }));
    watcher.on('unlink', (file) => callback({ event: 'unlink', file: toPath(file) }));
  }

  public async outputKV1(filePath: string, data: Record<string, any>, utf16 = false) {
    assert(path.isAbsolute(filePath), 'filePath should be absolute');

    let fileContent = vdf.stringify(data, this.outputOptions);

    const headerMessage = getOutputHeader(this.outputOptions, filePath);
    if (headerMessage != null) {
      fileContent = `// ${headerMessage.replace(/\n/g, '\n// ')}\n\n${fileContent}`;
    }

    if (utf16) {
      fileContent = `\uFEFF${fileContent}`;
    }

    await fs.outputFile(filePath, fileContent, { encoding: utf16 ? 'ucs2' : 'utf8' });
  }

  public async import(id: string) {
    return _import(id);
  }

  public resolvePath(request: string): string;
  public resolvePath(root: 'project' | 'game' | 'content', request: string): string;
  public resolvePath(arg1: string, arg2?: string) {
    const request = arg2 != null ? arg2 : arg1;
    const root = arg2 != null ? (arg1 as 'project' | 'game' | 'content') : 'project';

    if (path.isAbsolute(request)) return request;
    switch (root) {
      case 'project':
        return path.join(this.context, request);
      case 'game':
      case 'content':
        return path.join(this.dotaPath, root, 'dota_addons', this.addonName, request);
    }
  }

  public taskProvider: TaskProvider = (key) => this.tasks.get(key);

  public hasFlag(flag: string) {
    return Boolean(this.flags[flag]);
  }
}