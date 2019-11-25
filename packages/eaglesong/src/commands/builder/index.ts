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
import { buildReporter, watchReporter } from './reporters';
import { ResourceCompiler } from './resourcecompiler';

export interface BuildOptions {
  output?: OutputOptions;
  tasks: Task<any>[] | (() => Promise<Task<any>[]>);
}

export default class BuilderCommand extends CommandGroup {
  protected args: {
    pushLocalizations?: boolean;
    skipCompilation?: boolean;
    noDota?: boolean;
  } = {};

  public readonly hooks = createHooks();
  private readonly tasks: TaskMap = new Map();
  private reporter = buildReporter;

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
      command: 'dev',
      describe:
        'Runs tasks in development mode, watching for resources and building them as-needed.',
      handler: () => this.runWatch(),
      builder: argv => argv.options(buildOptions),
    });

    this.command({
      command: 'build',
      describe:
        'Runs tasks in production mode, optimizing resources and compiling them with resourcecompiler.',
      handler: () => errorOnFailure(this.runBuild()),
      builder: argv =>
        argv.options({
          ...buildOptions,
          'skip-compilation': {
            describe: 'Skip resourcecompiler execution',
            type: 'boolean',
            default: false,
          },
        }),
    });

    this.command({
      command: 'generate-static',
      describe: 'Generates support information, such as TypeScript declarations.',
      handler: () => errorOnFailure(this.runGenerateStatic()),
    });
  }

  public async runWatch() {
    await this.loadTasks(true, Boolean(this.args.noDota));
    this.reporter = watchReporter;
    this.report();

    await this.hooks.boot.promise();
    await this.hooks.preBuild.promise();
    await this.hooks.build.promise();

    await new Promise<never>(() => {});
  }

  public async runBuild() {
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

  public async runGenerateStatic() {
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
    let { tasks, output } = await this.getOptions();
    if (typeof tasks === 'function') tasks = await tasks();
    if (tasks.length === 0) throw new Error('Builder got an empty task list');
    tasks.forEach(t => this.tasks.set(t.constructor as TaskConstructor<any>, t));

    const helper = new BuildHelper(
      this.context,
      noDota ? undefined : await this.getDotaPath(),
      await this.getAddonName(),
      output != null ? output : {},
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
