import createDotaTransformer from 'dota-lua-types/transformer';
import path from 'path';
import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';
import { AppCompilation } from './app-compilation';
import { ModuleLoadingError } from './transpiler/compilation';
import { CustomLuaTransformer } from './transpiler/tstl';

export function createConfigFileUpdater() {
  const configFileMap = new WeakMap<ts.TsConfigSourceFile, ts.ParsedCommandLine>();

  return (options: ts.CompilerOptions): ts.Diagnostic[] => {
    const configFile = options.configFile as ts.TsConfigSourceFile | undefined;
    const configFilePath = options.configFilePath as string | undefined;
    if (!configFile || !configFilePath) return [];

    if (!configFileMap.has(configFile)) {
      const result = tstl.updateParsedConfigFile(
        ts.parseJsonSourceFileConfigFileContent(
          configFile,
          ts.sys,
          path.dirname(configFilePath),
          { luaTarget: tstl.LuaTarget.LuaJIT, luaLibImport: tstl.LuaLibImportKind.Require },
          configFilePath,
        ),
      );

      configFileMap.set(configFile, result);
    }

    const parsedConfigFile = configFileMap.get(configFile)!;
    Object.assign(options, parsedConfigFile.options);
    return parsedConfigFile.errors;
  };
}

export function transpileProgram(
  program: ts.Program,
  commonRoot?: string,
): { diagnostics: ts.Diagnostic[]; errors: ModuleLoadingError[] } {
  const transformer = new CustomLuaTransformer(program);
  const { diagnostics: transpileDiagnostics, transpiledFiles } = tstl.transpile({
    program,
    customTransformers: { before: [createDotaTransformer()] },
    transformer,
  });

  const diagnostics = ts.sortAndDeduplicateDiagnostics([
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...transpileDiagnostics,
  ]);

  const compilation = new AppCompilation(program, undefined, commonRoot);
  const { errors } = compilation.emit(transpiledFiles);

  return { diagnostics: [...diagnostics], errors };
}
