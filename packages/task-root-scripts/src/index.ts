import {
  createTaskGroup,
  createTsAutoWatch,
  LintedTransformTask,
  runTsLint,
  Task,
} from '@eaglesong/helper-task';

class LintInternalTask extends LintedTransformTask<void> {
  protected pattern = ['**/*', '!**/*.{ts,tsx,js,jsx}', '!src', '!node_modules'];

  public constructor() {
    super(undefined);
  }
}

class TypeScriptInternalTask extends Task<void> {
  public constructor() {
    super(undefined);
  }

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, async () => {
      createTsAutoWatch(
        this.context,
        this.resolvePath('project', 'tsconfig.json'),
        { noEmit: true },
        this.isWatching,
        () => {
          this.removeErrors();
          this.start();
        },
        this.error,
        async builderProgram => {
          const program = builderProgram.getProgram();
          runTsLint(this.error, this.resolvePath('project', 'tslint.json'), program);
          this.finish();
        },
      );
    });
  }
}

export default class RootScriptsTask extends createTaskGroup<void>([
  LintInternalTask,
  TypeScriptInternalTask,
]) {}
