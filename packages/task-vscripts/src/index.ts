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
    this.hooks.build.tapPromise(this.constructor.name, async () => {
      const tsconfigPath = this.resolvePath('src/vscripts/tsconfig.json');
      const outDir = this.resolvePath('game', 'scripts/vscripts');
      await copyLuaLib(outDir);

      const updateConfigFile = createConfigFileUpdater();
      const forceProgramUpdate = createTsAutoWatch(
        this.resolvePath('src/vscripts'),
        tsconfigPath,
        { outDir, rootDir: this.resolvePath('src/vscripts') },
        this.isWatching,
        () => {
          this.removeErrors();
          this.start();
        },
        this.error,
        builderProgram => {
          const options = builderProgram.getCompilerOptions();
          updateConfigFile(options);
          if (!options.noEmit) {
            options.noEmit = this.dotaPath == null;
          }

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
    const { diagnostics, errors } = transpileProgram(program, this.resolvePath('src/common'));
    errors.forEach(x => this.error(x.fileName, x.message));
    diagnostics.forEach(x => reportTsDiagnostic(this.error, x));
  }
}
