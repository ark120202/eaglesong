import { ServiceErrorReporter, TaskProvider, TransformTask } from '@eaglesong/helper-task';
import fs from 'fs-extra';
import _ from 'lodash';
import path from 'upath';
import * as defaultPlugins from './plugins';
import { NpcService, Plugin, Schemas } from './service';

export * from './service';

export interface Options {
  defaultPlugins?: boolean | Partial<Record<keyof typeof defaultPlugins, boolean>>;
  customPlugins?: Plugin[];
}

export function createNpcService(
  context: string,
  options: Options,
  taskProvider: TaskProvider,
  error: ServiceErrorReporter,
) {
  const plugins = [];

  if (options.defaultPlugins !== false) {
    for (const name of Object.keys(defaultPlugins) as (keyof typeof defaultPlugins)[]) {
      if (typeof options.defaultPlugins !== 'object' || options.defaultPlugins[name] !== false) {
        plugins.push(defaultPlugins[name]);
      }
    }
  }

  if (options.customPlugins) {
    plugins.push(...options.customPlugins);
  }

  return new NpcService(context, plugins, taskProvider, error);
}

export default class NpcTask extends TransformTask<Options> {
  protected pattern = ['src/npc/**/*', '!**/_*'];

  constructor(options: Options = {}) {
    super(options);
  }

  private service!: NpcService;
  public apply() {
    this.service = createNpcService(
      this.context,
      this.options,
      this.taskProvider,
      ({ fileName, ...error }) => {
        this.error({
          ...error,
          filePath: fileName != null ? this.resolvePath(`src/npc/${fileName}`) : fileName,
        });
      },
    );

    this.hooks.preBuild.tapPromise(this.constructor.name, async () => {
      const schemas: Schemas = {};
      await this.service.hooks.schemas.promise(schemas);
      const compiledSchemas = Object.entries(schemas).map(([name, schema]) => {
        const { content, globals } = schema.toTypeScriptRoot(_.upperFirst(_.camelCase(name)));
        return { name, content, globals, schema };
      });

      let globals = _.union(...compiledSchemas.map(x => x.globals))
        .sort((a, b) => a.localeCompare(b))
        .join('\n\n');
      globals += '\n';

      const getPath = (fileName: string) => this.resolvePath(`.eaglesong/${fileName}`);
      await Promise.all([
        fs.outputFile(getPath('types/npc-globals.d.ts'), globals),
        ...compiledSchemas.flatMap(({ name, content, schema }) => [
          fs.outputFile(getPath(`types/${name}.d.ts`), content),
          fs.outputJson(getPath(`schemas/npc/${name}.json`), schema.toSchema(), { spaces: 2 }),
        ]),
      ]);
    });

    super.apply();
  }

  protected async transformFile(filePath: string) {
    const content = await this.import(filePath);
    this.service.addFile(path.relative(this.resolvePath('src/npc'), filePath), content);
  }

  protected removeFile(filePath: string) {
    this.service.removeFile(path.relative(this.resolvePath('src/npc'), filePath));
  }

  protected async afterWatch() {
    if (this.getErrorLevel() != null) return;

    const artifacts = await this.service.emit();
    if (this.dotaPath == null) return;

    await Promise.all(
      Object.entries(artifacts).map(([group, kv]) =>
        this.outputKV1(this.resolvePath('game', `scripts/npc/${group}.txt`), { '': kv }),
      ),
    );
  }
}
