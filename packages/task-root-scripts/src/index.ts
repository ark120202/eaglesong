import * as ts from 'typescript';
import { createTsAutoWatch, Task, createDiagnosticReporter } from '@eaglesong/helper-task';

export default class RootScriptsTask extends Task<void> {
  constructor() {
    super(undefined);
  }

  private readonly reportDiagnostic = createDiagnosticReporter(this.error);
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
        builderProgram => {
          ts.getPreEmitDiagnostics(builderProgram.getProgram()).forEach(this.reportDiagnostic);
          this.finish();
        },
      );
    });
  }
}
