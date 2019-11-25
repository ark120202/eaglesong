import { createDiagnosticReporter, createTsAutoWatch, Task } from '@eaglesong/helper-task';
import createDotaTransformer from 'dota-lua-types/transformer';
import ts from 'typescript';
import * as tstl from 'typescript-to-lua';
import { createConfigFileUpdater } from 'typescript-to-lua/dist/cli/tsconfig';
import { CustomCompilation } from './compilation';
import { LuaTransformer } from './transpiler/transformer';

export default class VScriptsTask extends Task<void> {
  constructor() {
    super(undefined);
  }

  public apply() {
    this.hooks.build.tap(this.constructor.name, () => {
      const outDir =
        this.dotaPath != null ? this.resolvePath('game', 'scripts/vscripts') : undefined;

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
  private readonly updateConfigFile = createConfigFileUpdater({
    luaTarget: tstl.LuaTarget.LuaJIT,
    luaLibImport: tstl.LuaLibImportKind.Require,
  });

  private emit(program: ts.Program) {
    const options = program.getCompilerOptions();
    const configFileParsingDiagnostics = this.updateConfigFile(options);
    if (!options.noEmit) {
      options.noEmit = this.dotaPath == null;
    }

    const { diagnostics: transpileDiagnostics, transpiledFiles } = tstl.transpile({
      program,
      customTransformers: { before: [createDotaTransformer()] },
      transformer: new LuaTransformer(program),
    });

    const compilation = new CustomCompilation(program, undefined, this.resolvePath('src/common'));
    const { errors } = compilation.emit(transpiledFiles);

    const diagnostics = ts.sortAndDeduplicateDiagnostics([
      ...configFileParsingDiagnostics,
      ...program.getOptionsDiagnostics(),
      ...program.getSyntacticDiagnostics(),
      ...program.getGlobalDiagnostics(),
      ...program.getSemanticDiagnostics(),
      ...transpileDiagnostics,
    ]);

    diagnostics.forEach(this.reportDiagnostic);
    for (const { fileName, message } of errors) {
      this.error({ filePath: fileName, message });
    }
  }
}
