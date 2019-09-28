import { createTsAutoWatch, Task } from '@eaglesong/helper-task';

export default class RootScriptsTask extends Task<void> {
  constructor() {
    super(undefined);
  }

  public apply() {
    this.hooks.build.tap(this.constructor.name, () => {
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
        () => this.finish(),
      );
    });
  }
}
