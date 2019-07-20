import {
  BuildHelper,
  createHooks,
  OutputOptions,
  Task,
  TaskConstructor,
  TaskMap,
} from '@eaglesong/helper-task';
import path from 'upath';
import { CommandGroup } from '../../command';
import { buildReporter, Reporter, watchReporter } from './reporters';
import { ResourceCompiler } from './resourcecompiler';

export interface BuildOptions {
  output?: Partial<OutputOptions>;
  buildTasks: Task<any>[] | (() => Promise<Task<any>[]>);
}

export default class BuilderCommand extends CommandGroup {
  protected args: { pushLocalizations: boolean } = { pushLocalizations: false };
  // FIXME:
  public hooks: ReturnType<typeof createHooks> = createHooks();
  private readonly definitionsPath = path.join(this.context, 'node_modules/.definitions');
  private readonly tasks: TaskMap = new Map();
  private reporter: Reporter = buildReporter;

  public register() {
    this.command({
      command: 'dev',
      describe: 'Run Dota 2 and watch for resources',
      handler: () => this.watch(),
    });

    const errorOnFailure = (promise: Promise<boolean>) =>
      (async () => {
        if (!(await promise)) {
          process.exitCode = 1;
        }
      })();

    this.command({
      command: 'build',
      describe: 'Build and compile all resources for production release',
      handler: () => errorOnFailure(this.build()),
    });
    this.command({
      builder: argv =>
        argv.option('push-localizations', {
          describe: '[LocalizationBuilder] Push base files to localization platform',
          type: 'boolean',
          default: false,
        }),
      command: 'ci',
      describe: 'Run all build tasks without emitting any output',
      handler: () => errorOnFailure(this.ci()),
    });
  }

  public async build() {
    if (process.env.NODE_ENV == null) process.env.NODE_ENV = 'production';
    await this.loadTasks(false, true);
    this.report();

    await this.hooks.boot.promise();
    await this.hooks.definitions.promise(this.definitionsPath);
    await this.hooks.build.promise();

    const compiler = new ResourceCompiler(await this.getDotaPath(), await this.getAddonName());
    await this.hooks.compile.promise(p => compiler.addResource(p));
    console.log('Starting compilation...');
    await compiler.compile();
    console.log('Compilation finished');

    return this.isSuccess();
  }

  private async ci() {
    await this.loadTasks(false, false);
    this.report();

    await this.hooks.boot.promise();
    await this.hooks.definitions.promise(this.definitionsPath);
    await this.hooks.build.promise();

    return this.isSuccess();
  }

  private async watch() {
    await this.loadTasks(true, true);
    this.reporter = watchReporter;
    this.report();

    await this.hooks.boot.promise();
    await this.hooks.definitions.promise(this.definitionsPath);
    await this.hooks.build.promise();

    await new Promise<never>(() => {});
  }

  private isSuccess() {
    return [...this.tasks.values()].every(t => t.errorLevel == null);
  }

  private report() {
    this.reporter(this.context, [...this.tasks.values()]);
  }

  private async loadTasks(isWatching: boolean, allowSideEffects: boolean) {
    let { buildTasks, output } = await this.getOptions();
    if (typeof buildTasks === 'function') buildTasks = await buildTasks();
    if (buildTasks.length === 0) throw new Error('Builder got an empty task list');
    buildTasks.forEach(t => this.tasks.set(t.constructor as TaskConstructor<any>, t));

    const helper = new BuildHelper(
      this.context,
      allowSideEffects ? await this.getDotaPath() : undefined,
      await this.getAddonName(),
      output != null ? output : {},
      new Map(),
      this.hooks,
      this.tasks,
      isWatching,
      this.args,
    );

    for (const task of this.tasks.values()) {
      task.setHelper(helper);
      task._stateCallback = () => this.report();
    }

    await Promise.all([...this.tasks.values()].map(p => p.apply()));
  }
}
