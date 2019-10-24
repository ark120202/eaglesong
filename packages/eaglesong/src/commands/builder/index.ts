import {
  BuildHelper,
  createHooks,
  OutputOptions,
  Task,
  TaskConstructor,
  TaskMap,
} from '@eaglesong/helper-task';
import yargs from 'yargs';
import { CommandGroup } from '../../command';
import { buildReporter, Reporter, watchReporter } from './reporters';
import { ResourceCompiler } from './resourcecompiler';

export interface BuildOptions {
  output?: Partial<OutputOptions>;
  buildTasks: Task<any>[] | (() => Promise<Task<any>[]>);
}

export default class BuilderCommand extends CommandGroup {
  protected args: {
    pushLocalizations?: boolean;
    skipCompilation?: boolean;
    noDota?: boolean;
  } = {};

  // FIXME:
  public hooks: ReturnType<typeof createHooks> = createHooks();
  private readonly tasks: TaskMap = new Map();
  private reporter: Reporter = buildReporter;

  public register() {
    const errorOnFailure = (promise: Promise<boolean>) =>
      (async () => {
        if (!(await promise)) {
          process.exitCode = 1;
        }
      })();

    const buildOptions: Record<string, yargs.Options> = {
      'no-dota': {
        describe: 'Run build without using Dota 2 client files',
        type: 'boolean',
        default: false,
      },
    };

    this.command({
      builder: argv => argv.options(buildOptions),
      command: 'dev',
      describe: 'Build and watch for resources',
      handler: () => this.watch(),
    });

    this.command({
      builder: argv =>
        argv.options({
          ...buildOptions,
          'skip-compilation': {
            describe: 'Skip resourcecompiler execution',
            type: 'boolean',
            default: false,
          },
        }),
      command: 'build',
      describe: 'Build and compile all resources for production environment',
      handler: () => errorOnFailure(this.build()),
    });

    this.command({
      command: 'generate-static',
      describe: 'Generate static files for other tools',
      handler: () => errorOnFailure(this.generateStatic()),
    });
  }

  public async watch() {
    await this.loadTasks(true, Boolean(this.args.noDota));
    this.reporter = watchReporter;
    this.report();

    await this.hooks.boot.promise();
    await this.hooks.preBuild.promise();
    await this.hooks.build.promise();

    await new Promise<never>(() => {});
  }

  public async build() {
    if (this.args.skipCompilation && this.args.noDota) {
      console.log('--no-dota implies --skip-compilation, so they should not be specified together');
      return false;
    }

    if (process.env.NODE_ENV == null) process.env.NODE_ENV = 'production';
    await this.loadTasks(false, Boolean(this.args.noDota));
    this.report();

    await this.hooks.boot.promise();
    await this.hooks.preBuild.promise();
    await this.hooks.build.promise();

    if (!(this.args.skipCompilation || this.args.noDota)) {
      const compiler = new ResourceCompiler(await this.getDotaPath(), await this.getAddonName());
      await this.hooks.compile.promise(p => compiler.addResource(p));

      console.log('');
      console.log('Executing resourcecompiler...');
      if (!(await compiler.compile())) {
        return false;
      }
    }

    return this.isSuccess();
  }

  public async generateStatic() {
    await this.loadTasks(false, true);
    this.report();

    await this.hooks.boot.promise();
    await this.hooks.preBuild.promise();

    return this.isSuccess();
  }

  private isSuccess() {
    return [...this.tasks.values()].every(t => t.errorLevel == null);
  }

  private report() {
    this.reporter(this.context, [...this.tasks.values()]);
  }

  private async loadTasks(isWatching: boolean, noDota: boolean) {
    let { buildTasks, output } = await this.getOptions();
    if (typeof buildTasks === 'function') buildTasks = await buildTasks();
    if (buildTasks.length === 0) throw new Error('Builder got an empty task list');
    buildTasks.forEach(t => this.tasks.set(t.constructor as TaskConstructor<any>, t));

    const helper = new BuildHelper(
      this.context,
      noDota ? undefined : await this.getDotaPath(),
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
