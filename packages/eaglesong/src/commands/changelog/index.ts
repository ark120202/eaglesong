import { ServiceMap } from '@eaglesong/helper-service';
import { BuildHelper, createHooks, TaskConstructor, TaskMap } from '@eaglesong/helper-task';
import _ from 'lodash';
import simpleGit from 'simple-git/promise';
import { CommandGroup } from '../../command';
import { ChangelogContextImpl } from './context';
import { makeFakeRepo } from './git';

export default class ChangelogCommand extends CommandGroup {
  private readonly git = simpleGit(this.context);
  protected args: { previous?: string } = {};

  public register() {
    this.command({
      builder: argv =>
        argv.option('previous', { type: 'string', describe: 'Previous revision hash/tag' }),
      command: 'changelog',
      describe: 'Generate changelog',
      handler: () => this.changelog(),
    });
  }

  private async changelog() {
    if (!(await this.git.checkIsRepo())) {
      throw new Error(`"${this.context}" is not a valid git repository`);
    }

    const { previous: previousHash = (await this.git.tags()).latest || 'HEAD' } = this.args;

    const [old, current] = await Promise.all(
      [true, false].map(async isOld => {
        const tasks: TaskMap = new Map();
        let { buildTasks } = await this.getOptions();
        if (buildTasks == null) throw new Error('Builder got empty task list');
        if (typeof buildTasks === 'function') buildTasks = await buildTasks();
        if (buildTasks.length === 0) throw new Error('Builder got empty task list');
        buildTasks.forEach(t => tasks.set(t.constructor as TaskConstructor<any>, t));

        const services: ServiceMap = new Map();
        const hooks = createHooks();
        const context = isOld
          ? await makeFakeRepo(this.context, previousHash, ['src', 'tsconfig.json', 'tslint.json'])
          : this.context;
        const helper = new BuildHelper(
          context,
          undefined,
          await this.getAddonName(),
          {},
          services,
          hooks,
          tasks,
          false,
          {},
        );

        tasks.forEach(p => {
          p.setHelper(helper);
          p._stateCallback = _.noop;
        });

        await Promise.all([...tasks.values()].map(p => p.apply()));
        await hooks.boot.promise();
        return { isOld, hooks, tasks, services };
      }),
    );

    console.log(`<!-- Diff between ${previousHash} and HEAD -->`);
    const changelogContext = new ChangelogContextImpl();

    const commits = [
      'fix(runes): picking up Fire crashes game',
      'fix(hero_selection): selecting random hero gives infinite gold',
      'feat(',
    ];
    const fixesGroup = changelogContext.group('Fixes');
    commits.filter(x => x.startsWith('fix')).forEach(x => fixesGroup.addLine(x));
    console.log(changelogContext.toMarkdown());

    await current.hooks.changelog.promise({
      write: message => console.log(message),
      oldTaskProvider: x => old.tasks.get(x),
      oldServiceProvider: x => old.services.get(x),
    });
  }
}
