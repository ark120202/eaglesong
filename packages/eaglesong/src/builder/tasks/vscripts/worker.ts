import createDotaTransformer from 'dota-lua-types/transformer';
import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';
import { createConfigFileUpdater } from 'typescript-to-lua/dist/cli/tsconfig';
import { parentPort, workerData as rawWorkerData } from 'worker_threads';
import { convertDiagnosticToError, createTsAutoWatch, ErrorMessage } from '../../helper';

export type Message = { type: 'start' } | { type: 'end'; errors: ErrorMessage[] };
const postMessage = (message: Message) => parentPort!.postMessage(message);

const workerData: WorkerData = rawWorkerData;
export interface WorkerData {
  configPath: string;
  isWatching: boolean;
  rootDir: string;
  outDir?: string;
}

const updateConfigFile = createConfigFileUpdater({
  luaTarget: tstl.LuaTarget.LuaJIT,
  luaLibImport: tstl.LuaLibImportKind.Require,
});

const compiler = new tstl.Compiler();

function emit(program: ts.Program) {
  const options = program.getCompilerOptions();
  const configFileParsingDiagnostics = updateConfigFile(options);

  options.noEmit ||= options.outDir === undefined;

  const { diagnostics: emitDiagnostics } = compiler.emit({
    program,
    customTransformers: { before: [createDotaTransformer()] },
  });

  const diagnostics = ts.sortAndDeduplicateDiagnostics([
    ...configFileParsingDiagnostics,
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...emitDiagnostics,
  ]);

  return diagnostics.filter((diag) => diag.code !== 6059).map(convertDiagnosticToError);
}

createTsAutoWatch(
  workerData.rootDir,
  workerData.configPath,
  { rootDir: workerData.rootDir, outDir: workerData.outDir },
  workerData.isWatching,
  () => postMessage({ type: 'start' }),
  (builderProgram) => postMessage({ type: 'end', errors: emit(builderProgram.getProgram()) }),
);
