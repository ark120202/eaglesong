import _ from 'lodash';
import * as ts from 'typescript';
import { ServiceErrorReporter } from '../service';

export function reportTsDiagnostic(error: ServiceErrorReporter, diagnostic: ts.Diagnostic) {
  const level = diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning';
  if (!diagnostic.file) {
    error(null, `${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`, level);
    return;
  }

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const { fileName } = diagnostic.file;
  error(fileName, `(${line + 1},${character + 1}) TS${diagnostic.code}: ${message}`, level);
}

export type Program = ts.Program;
export function createTsAutoWatch(
  currentDirectory: string,
  configPath: string,
  optionsToExtend: ts.CompilerOptions | undefined,
  isWatching: boolean,
  onWatchStart: () => void,
  error: ServiceErrorReporter,
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
    diag => reportTsDiagnostic(error, diag),
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
