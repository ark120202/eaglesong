import { CLIEngine } from 'eslint';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { parentPort, workerData } from 'worker_threads';

const options: CLIEngine.Options = workerData;
const cliEngine = new CLIEngine(options);

parentPort!.on('message', () => {
  parentPort!.postMessage(cliEngine.executeOnFiles(['.']).results);
});
