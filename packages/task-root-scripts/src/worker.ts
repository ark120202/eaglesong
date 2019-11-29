import { convertDiagnosticToError, createTsAutoWatch, ErrorMessage } from '@eaglesong/helper-task';
import * as ts from 'typescript';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { parentPort, workerData as rawWorkerData } from 'worker_threads';

export type Message = { type: 'start' } | { type: 'end'; errors: ErrorMessage[] };
const postMessage = (message: Message) => parentPort!.postMessage(message);

const workerData: WorkerData = rawWorkerData;
export interface WorkerData {
  currentDirectory: string;
  configPath: string;
  isWatching: boolean;
}

createTsAutoWatch(
  workerData.currentDirectory,
  workerData.configPath,
  { noEmit: true },
  workerData.isWatching,
  () => postMessage({ type: 'start' }),
  builderProgram => {
    const diagnostics = ts.getPreEmitDiagnostics(builderProgram.getProgram());
    postMessage({ type: 'end', errors: diagnostics.map(convertDiagnosticToError) });
  },
);
