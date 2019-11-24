import {
  BuildHelper,
  createHooks,
  ServiceMap,
  TaskConstructor,
  TaskMap,
} from '@eaglesong/helper-task';
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
      command: 'changelog',
      describe: 'Generate changelog',
      handler: () => this.run(),
      builder: argv =>
        argv.option('previous', { type: 'string', describe: 'Previous revision hash/tag' }),
    });
  }

  private async run() {
    if (!(await this.git.checkIsRepo())) {
      throw new Error(`"${this.context}" is not a valid git repository`);
    }

    const previousHash = this.args.previous || (await this.git.tags()).latest || 'HEAD';

    const [old, current] = await Promise.all(
      [true, false].map(async isOld => {
        const tasks: TaskMap = new Map();
        let { tasks: tasksOption } = await this.getOptions();
        if (tasksOption == null) throw new Error('Builder got empty task list');
        if (typeof tasksOption === 'function') tasksOption = await tasksOption();
        if (tasksOption.length === 0) throw new Error('Builder got empty task list');
        tasksOption.forEach(t => tasks.set(t.constructor as TaskConstructor<any>, t));

        const services: ServiceMap = new Map();
        const hooks = createHooks();
        const context = isOld
          ? await makeFakeRepo(this.context, previousHash, ['src', 'tsconfig.json'])
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
