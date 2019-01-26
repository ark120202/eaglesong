import { evaluateFile } from '@eaglesong/helper-service/lib/evaluate';
import _ from 'lodash';
import path from 'path';
import { Hooks, NpcPluginApi } from '..';

const EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx', '.js', '.jsx']);

export function EvaluateScriptsPlugin(hooks: Hooks, api: NpcPluginApi) {
  hooks.transform.tapPromise({ name: 'ExportDefaultPlugin', stage: -20 }, async files => {
    await Promise.all(
      Object.entries(files).map(async ([fileName, file]) => {
        if (!EXTENSIONS.has(path.extname(fileName))) return;

        if (!file.__esModule) return;
        delete file.__esModule;

        await evaluateFile(api, file, fileName);

        if (file.default != null) {
          const def = file.default;
          delete file.default;
          Object.assign(file, def);
        }
      }),
    );
  });
}
