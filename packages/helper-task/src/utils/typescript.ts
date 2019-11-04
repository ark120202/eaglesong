import _ from 'lodash';
import * as ts from 'typescript';
import { ServiceErrorReporter } from '../service';

export const createDiagnosticReporter = (error: ServiceErrorReporter) => (diag: ts.Diagnostic) => {
  const level = diag.category === ts.DiagnosticCategory.Error ? 'error' : 'warning';
  const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');

  if (diag.file && diag.start != null) {
    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
    error(diag.file.fileName, `(${line + 1},${character + 1}) TS${diag.code}: ${message}`, level);
  } else {
    error(null, message, level);
  }
};

export function createTsAutoWatch(
  currentDirectory: string,
  configPath: string,
  optionsToExtend: ts.CompilerOptions | undefined,
  isWatching: boolean,
  onWatchStart: () => void,
  onProgram: (program: ts.SemanticDiagnosticsBuilderProgram) => void,
) {
  const system: ts.System = { ...ts.sys, getCurrentDirectory: () => currentDirectory };
  if (!isWatching) {
    system.watchFile = () => ({ close: _.noop });
    system.watchDirectory = () => ({ close: _.noop });
  }

  const host = ts.createWatchCompilerHost(
    configPath,
    optionsToExtend,
    system,
    ts.createSemanticDiagnosticsBuilderProgram,
    undefined, // Used only in standard `afterProgramCreate` handler
    ({ code }) => {
      if (code === 6032) onWatchStart();
    },
  );

  host.afterProgramCreate = onProgram;

  const watchProgram = ts.createWatchProgram(host);
  return () => {
    watchProgram.getProgram();
  };
}
