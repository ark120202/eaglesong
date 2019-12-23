import { ServiceErrorReporter, TaskProvider, TransformTask } from '@eaglesong/helper-task';
import fs from 'fs-extra';
import _ from 'lodash';
import path from 'upath';
import { Plugin } from './plugin';
import * as defaultPlugins from './plugins';
import { Schemas, ScriptsService } from './service';

export * from './plugin';
export * from './service';

export interface Options {
  defaultPlugins?: boolean | Partial<Record<keyof typeof defaultPlugins, boolean>>;
  customPlugins?: Plugin[];
}

export function createScriptsService(
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

  return new ScriptsService(context, plugins, taskProvider, error);
}

export default class ScriptsTask extends TransformTask<Options> {
  protected pattern = ['src/scripts/**/*', '!**/_*'];

  constructor(options: Options = {}) {
    super(options);
  }

  private service!: ScriptsService;
  public apply() {
    this.service = createScriptsService(
      this.context,
      this.options,
      this.taskProvider,
      ({ fileName, ...error }) => {
        this.error({
          ...error,
          filePath: fileName != null ? this.resolvePath(`src/scripts/${fileName}`) : fileName,
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
        fs.outputFile(getPath('types/scripts/globals.d.ts'), globals),
        ...compiledSchemas.flatMap(({ name, content, schema }) => [
          fs.outputFile(getPath(`types/scripts/${name}.d.ts`), content),
          fs.outputJson(getPath(`schemas/scripts/${name}.json`), schema.toSchema(), { spaces: 2 }),
        ]),
      ]);
    });

    super.apply();
  }

  protected async transformFile(filePath: string) {
    const content = await this.import(filePath);
    this.service.addFile(path.relative(this.resolvePath('src/scripts'), filePath), content);
  }

  protected removeFile(filePath: string) {
    this.service.removeFile(path.relative(this.resolvePath('src/scripts'), filePath));
  }

  protected async afterWatch() {
    if (this.getErrorLevel() != null) return;

    const artifacts = await this.service.emit();
    if (this.dotaPath == null) return;

    await Promise.all(
      Object.entries(artifacts).map(async ([group, kv]) => {
        const filePath = this.resolvePath('game', `scripts/${group}.txt`);

        if (group === 'custom_net_tables') {
          const content = `<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->
{ custom_net_tables = ${JSON.stringify(kv.custom_net_tables)} }
`;

          await fs.outputFile(filePath, content);
        } else {
          await this.outputKV1(filePath, { '': kv });
        }
      }),
    );
  }
}
