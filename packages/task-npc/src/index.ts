import { ServiceErrorReporter, ServiceProvider, TriggerChange } from '@eaglesong/helper-service';
import { LintedTransformTask } from '@eaglesong/helper-task';
import { defaultPlugins, NpcPlugin, NpcService, Schemas } from '@eaglesong/service-npc';
import fs from 'fs-extra';
import _ from 'lodash';
import path from 'upath';

export interface Options {
  plugins?: NpcPlugin[];
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

export default class NpcTask extends LintedTransformTask<Options> {
  protected pattern = ['src/npc/**/*', '!**/_*'];

  public constructor(options: Options = {}) {
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

    this.hooks.definitions.tapPromise(this.constructor.name, async definitionsPath => {
      const schemas: Schemas = {};
      await this.service.hooks.schemas.promise(schemas);

      const compiledSchemas = Object.entries(schemas).map(([name, schema]) => {
        const { content, globals } = schema.toTypeScriptRoot(_.upperFirst(_.camelCase(name)));
        return { name, content, globals, schema };
      });

      let types = '';
      types += Object.keys(schemas)
        .map(name => `import './${name}';`)
        .join('\n');
      types += '\n\n';
      types += 'declare global {\n';
      types += _.union(...compiledSchemas.map(x => x.globals)).join('\n\n');
      types += '\n}\n';

      const getPath = (name: string) => path.join(definitionsPath, name);
      await Promise.all([
        fs.outputFile(getPath('index.d.ts'), types),
        ..._.flatMap(compiledSchemas, ({ name, content, schema }) => [
          fs.outputJson(getPath(name + '.json'), schema.toSchema(), { spaces: 2 }),
          fs.outputFile(getPath(name + '.d.ts'), content),
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
    await super.transformFile(filePath);
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
      Object.entries(artifacts).map(async ([group, kv]) =>
        this.outputKV1(this.resolvePath('game', `scripts/npc/${group}.txt`), { '': kv }),
      ),
    );
  }
}
