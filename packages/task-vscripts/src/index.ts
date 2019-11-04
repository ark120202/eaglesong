import { createTsAutoWatch, createDiagnosticReporter, Task } from '@eaglesong/helper-task';
import { createConfigFileUpdater, transpileProgram } from '@eaglesong/helper-tstl';
import fs from 'fs-extra';
import path from 'path';
import ts from 'typescript';

const tstlPath = path.dirname(require.resolve('typescript-to-lua/package.json'));
const copyLuaLib = (to: string) =>
  fs.copy(path.join(tstlPath, 'dist/lualib/lualib_bundle.lua'), path.join(to, 'lualib_bundle.lua'));

export default class VScriptsTask extends Task<void> {
  constructor() {
    super(undefined);
  }

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, async () => {
      let outDir: string | undefined;
      if (this.dotaPath != null) {
        outDir = this.resolvePath('game', 'scripts/vscripts');
        await copyLuaLib(outDir);
      }

      const forceProgramUpdate = createTsAutoWatch(
        this.resolvePath('src/vscripts'),
        this.resolvePath('src/vscripts/tsconfig.json'),
        { outDir },
        this.isWatching,
        () => {
          this.removeErrors();
          this.start();
        },
        builderProgram => {
          this.emit(builderProgram.getProgram());
          this.finish();
        },
      );

      this.watch('src/{vscripts,common}/**/*.lua', () => {
        this.removeErrors();
        this.start();
        forceProgramUpdate();
      });
    });
  }

  private readonly reportDiagnostic = createDiagnosticReporter(this.error);
  private readonly updateConfigFile = createConfigFileUpdater();
  private emit(program: ts.Program) {
    const options = program.getCompilerOptions();
    const configFileParsingDiagnostics = this.updateConfigFile(options);
    if (!options.noEmit) {
      options.noEmit = this.dotaPath == null;
    }

    const { diagnostics, errors } = transpileProgram(program, this.resolvePath('src/common'));

    errors.forEach(x => this.error(x.fileName, x.message));
    ts.sortAndDeduplicateDiagnostics([...configFileParsingDiagnostics, ...diagnostics]).forEach(
      this.reportDiagnostic,
    );
  }
}
