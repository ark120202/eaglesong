import { evaluateServiceScript } from '@eaglesong/helper-task';
import path from 'path';
import { Hooks, LocalizationPluginApi } from '../service';

const EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx', '.js', '.jsx']);

export function EvaluateScriptsPlugin(hooks: Hooks, api: LocalizationPluginApi) {
  hooks.preprocess.tapPromise('EvaluateFunctionsPlugin', async (file, fileName) => {
    if (!EXTENSIONS.has(path.extname(fileName))) return;

    if (!file.__esModule) return;
    delete file.__esModule;

    await evaluateServiceScript(api, file, fileName);

    if (file.default != null) {
      const def = file.default;
      delete file.default;
      Object.assign(file, def);
    }
  });
}