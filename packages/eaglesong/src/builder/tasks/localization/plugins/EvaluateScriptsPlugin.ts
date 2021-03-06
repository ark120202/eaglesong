import path from 'path';
import { evaluateServiceScript } from '../../../helper';
import { Plugin } from '../service';

const EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx', '.js', '.jsx']);

export const EvaluateScriptsPlugin: Plugin = (api) => {
  api.hooks.preprocess.tapPromise('EvaluateFunctionsPlugin', async (file, fileName) => {
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
};
