import { CLIEngine } from 'eslint';
import { parentPort, workerData } from 'worker_threads';

const options: CLIEngine.Options = workerData;
const cliEngine = new CLIEngine(options);

parentPort!.on('message', () => {
  parentPort!.postMessage(cliEngine.executeOnFiles(['.']).results);
});
