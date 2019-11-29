import { convertDiagnosticToError, createTsAutoWatch, ErrorMessage } from '@eaglesong/helper-task';
import createDotaTransformer from 'dota-lua-types/transformer';
import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';
import { createConfigFileUpdater } from 'typescript-to-lua/dist/cli/tsconfig';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { parentPort, workerData as rawWorkerData } from 'worker_threads';
import { CustomCompilation } from './compilation';
import { LuaTransformer } from './transpiler/transformer';

export type Message = { type: 'start' } | { type: 'end'; errors: ErrorMessage[] };
const postMessage = (message: Message) => parentPort!.postMessage(message);

const workerData: WorkerData = rawWorkerData;
export interface WorkerData {
  currentDirectory: string;
  configPath: string;
  outDir?: string;
  isWatching: boolean;

  hasDota: boolean;
  commonRoot: string;
}

const updateConfigFile = createConfigFileUpdater({
  luaTarget: tstl.LuaTarget.LuaJIT,
  luaLibImport: tstl.LuaLibImportKind.Require,
});

function emit(program: ts.Program) {
  const options = program.getCompilerOptions();
  const configFileParsingDiagnostics = updateConfigFile(options);
  if (!options.noEmit) {
    options.noEmit = !workerData.hasDota;
  }

  const { diagnostics: transpileDiagnostics, transpiledFiles } = tstl.transpile({
    program,
    customTransformers: { before: [createDotaTransformer()] },
    transformer: new LuaTransformer(program),
  });

  const compilation = new CustomCompilation(program, undefined, workerData.commonRoot);
  const { errors } = compilation.emit(transpiledFiles);

  const diagnostics = ts.sortAndDeduplicateDiagnostics([
    ...configFileParsingDiagnostics,
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...transpileDiagnostics,
  ]);

  return [
    ...diagnostics.map(convertDiagnosticToError),
    ...errors.map(({ fileName, message }): ErrorMessage => ({ filePath: fileName, message })),
  ];
}

createTsAutoWatch(
  workerData.currentDirectory,
  workerData.configPath,
  { outDir: workerData.outDir },
  workerData.isWatching,
  () => postMessage({ type: 'start' }),
  builderProgram => postMessage({ type: 'end', errors: emit(builderProgram.getProgram()) }),
);
