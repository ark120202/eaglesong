import path from 'path';
import { evaluateServiceScript } from '../../../helper';
import { Plugin } from '../plugin';

const EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx', '.js', '.jsx']);

export const EvaluateScriptsPlugin: Plugin = (api) => {
  api.hooks.transform.tapPromise({ name: 'EvaluateScriptsPlugin', stage: -20 }, async (files) => {
    await Promise.all(
      Object.entries(files).map(async ([fileName, file]) => {
        if (!EXTENSIONS.has(path.extname(fileName))) return;

        if (!file.__esModule) return;
        delete file.__esModule;

        await evaluateServiceScript(api, file, fileName);

        if (file.default != null) {
          const def = file.default;
          delete file.default;
          Object.assign(file, def);
        }
      }),
    );
  });
};
