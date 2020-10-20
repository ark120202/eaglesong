import * as ts from 'typescript';
import { parentPort, workerData as rawWorkerData } from 'worker_threads';
import { convertDiagnosticToError, createTsAutoWatch, ErrorMessage } from '../../helper';

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
  (builderProgram) => {
    const diagnostics = ts.getPreEmitDiagnostics(builderProgram.getProgram());
    postMessage({ type: 'end', errors: diagnostics.map(convertDiagnosticToError) });
  },
);
