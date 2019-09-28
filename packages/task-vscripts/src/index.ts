import { createTsAutoWatch, reportTsDiagnostic, Task } from '@eaglesong/helper-task';
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
    const tsconfigPath = this.resolvePath('src/vscripts/tsconfig.json');

    this.hooks.build.tapPromise(this.constructor.name, async () => {
      const outDir = this.resolvePath('game', 'scripts/vscripts');
      await copyLuaLib(outDir);

      const updateConfigFile = createConfigFileUpdater();
      const forceProgramUpdate = createTsAutoWatch(
        this.resolvePath('src/vscripts'),
        tsconfigPath,
        {
          noEmit: true,
          outDir,
          rootDir: this.resolvePath('src/vscripts'),
        },
        this.isWatching,
        () => {
          this.removeErrors();
          this.start();
        },
        this.error,
        builderProgram => {
          updateConfigFile(builderProgram.getCompilerOptions());
          const program = builderProgram.getProgram();
          this.emit(program);
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

  private emit(program: ts.Program) {
    const options = program.getCompilerOptions();
    options.noEmit = this.dotaPath == null;
    const { diagnostics, errors } = transpileProgram(program, this.resolvePath('src/common'));
    options.noEmit = true;

    errors.forEach(x => this.error(x.fileName, x.message));
    diagnostics.forEach(x => reportTsDiagnostic(this.error, x));
  }
}
