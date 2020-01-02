import assert from 'assert';
import _ from 'lodash';
import * as ts from 'typescript';
import { ErrorMessage } from '../service';

export function convertDiagnosticToError(diagnostic: ts.Diagnostic): ErrorMessage {
  const level = diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning';
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

  if (!diagnostic.file) return { level, message };
  assert(diagnostic.start != null);

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
  return {
    filePath: diagnostic.file.fileName,
    level,
    message: `(${line + 1},${character + 1}) TS${diagnostic.code}: ${message}`,
  };
}

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
