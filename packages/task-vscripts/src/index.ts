import {
  createTsAutoWatch,
  getPrettierErrors,
  reportTsDiagnostic,
  runTsLint,
  Task,
  TaskState,
} from '@eaglesong/helper-task';
import { createConfigFileUpdater, transpileProgram } from '@eaglesong/helper-tstl';
import fs from 'fs-extra';
import path from 'path';
import ts from 'typescript';

const tstlPath = path.dirname(require.resolve('typescript-to-lua/package.json'));
export const copyLuaLib = (to: string) =>
  fs.copy(path.join(tstlPath, 'dist/lualib/lualib_bundle.lua'), path.join(to, 'lualib_bundle.lua'));

export default class VScriptsTask extends Task<void> {
  constructor() {
    super(undefined);
  }

  public apply() {
    const tsconfigPath = this.resolvePath('src/vscripts/tsconfig.json');

    this.hooks.build.tapPromise(this.constructor.name, async () => {
      let isInInternalCycle = true;
      let isOutdatedInLocalCycle = false;

      await copyLuaLib(this.resolvePath('game', 'scripts/vscripts'));
      const updateConfigFile = createConfigFileUpdater();
      const forceProgramUpdate = createTsAutoWatch(
        this.resolvePath('src/vscripts'),
        tsconfigPath,
        {
          noEmit: true,
          outDir: this.resolvePath('game', 'scripts/vscripts'),
          rootDir: this.resolvePath('src/vscripts'),
        },
        this.isWatching,
        () => {
          isInInternalCycle = true;
          this.removeErrors();
          this.start();
        },
        this.error,
        async builderProgram => {
          isInInternalCycle = false;
          try {
            updateConfigFile(builderProgram.getCompilerOptions());
            const program = builderProgram.getProgram();
            await this.lint(program);
            await this.emit(program);
          } catch (error) {
            // TODO:
            console.error(error);
            process.exit(1);
            return;
          }

          if (isOutdatedInLocalCycle) {
            isOutdatedInLocalCycle = false;
            this.removeErrors();
            forceProgramUpdate();
          } else {
            this.finish();
          }
        },
      );

      this.watch('src/{vscripts,common}/**/*.lua', () => {
        if (this.state !== TaskState.Working) {
          this.removeErrors();
          this.start();
          forceProgramUpdate();
        } else if (!isInInternalCycle) {
          isOutdatedInLocalCycle = true;
        }
      });
    });
  }

  private async lint(program: ts.Program) {
    const filePaths = await this.matchFiles('src/{vscripts,common}/**/*.json');
    await Promise.all(
      filePaths.map(async filePath => {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const errors = await getPrettierErrors(filePath, fileContent);
        errors.forEach(errorText => this.error(filePath, errorText));
      }),
    );

    runTsLint(this.error, this.resolvePath('src/vscripts/tslint.json'), program);
  }

  private async emit(program: ts.Program) {
    const options = program.getCompilerOptions();
    options.noEmit = this.dotaPath == null;
    const { diagnostics, errors } = transpileProgram(program, this.resolvePath('src/common'));
    options.noEmit = true;

    errors.forEach(x => this.error(x.fileName, x.message));
    diagnostics.forEach(x => reportTsDiagnostic(this.error, x));
  }
}
