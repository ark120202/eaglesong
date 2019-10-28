import {
  ServiceErrorReporter,
  ServiceProvider,
  TransformTask,
  TriggerChange,
} from '@eaglesong/helper-task';
import fs from 'fs-extra';
import _ from 'lodash';
import path from 'upath';
import { defaultPlugins, Plugin, NpcService, Schemas } from './service';

export * from './service';

export interface Options {
  plugins?: Plugin[];
  defaultPlugins?: boolean;
}

export function createNpcService(
  context: string,
  options: Options,
  serviceProvider: ServiceProvider,
  error: ServiceErrorReporter,
  triggerChange: TriggerChange,
) {
  const plugins = [
    ...(options.plugins != null ? options.plugins : []),
    ...(options.defaultPlugins !== false ? Object.values(defaultPlugins) : []),
  ];

  return new NpcService(context, plugins, serviceProvider, error, triggerChange);
}

export default class NpcTask extends TransformTask<Options> {
  protected pattern = ['src/npc/**/*', '!**/_*'];

  constructor(options: Options = {}) {
    super(options);
  }

  private get service() {
    const service = this.serviceProvider(NpcService);
    if (!service) throw new Error('Service not found');

    return service;
  }

  public apply() {
    this.hooks.boot.tap(this.constructor.name, () => {
      this.registerService(
        createNpcService(
          this.context,
          this.options,
          this.serviceProvider,
          (fileName, message, level) =>
            this.error(
              fileName != null ? this.resolvePath(`src/npc/${fileName}`) : fileName,
              message,
              level,
            ),
          fileName => this.triggerChange(fileName),
        ),
      );
    });

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

    this.hooks.changelog.tapPromise(this.constructor.name, async ({ write, oldTaskProvider }) => {
      const oldBuilder = oldTaskProvider(NpcTask)!;
      await Promise.all([
        ...(await this.matchFiles(this.pattern)).map(f => this.transformFile(f)),
        ...(await oldBuilder.matchFiles(oldBuilder.pattern)).map(f => oldBuilder.transformFile(f)),
      ]);

      const oldFiles = await oldBuilder.service.emit();
      const currentFiles = await this.service.emit();

      write(
        `${oldFiles.npc_abilities_custom.df.MaxLevel} => ${currentFiles.npc_abilities_custom.df.MaxLevel}`,
      );
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
    if (this.errorLevel) return;

    const artifacts = await this.service.emit();
    if (this.dotaPath == null) return;

    await Promise.all(
      Object.entries(artifacts).map(([group, kv]) =>
        this.outputKV1(this.resolvePath('game', `scripts/npc/${group}.txt`), { '': kv }),
      ),
    );
  }
}
