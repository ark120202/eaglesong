import { StringSchema } from '@dota-data/scripts/lib/schema';
import { resourcePatterns } from '@dota-data/scripts/lib/schemas/resources';
import fs from 'fs-extra';
import _ from 'lodash';
import path from 'path';
import { Hooks, NpcPluginApi } from '../..';

const stringResourcePatterns = _.mapValues(resourcePatterns, String) as Record<
  keyof typeof resourcePatterns,
  string
>;

export function CheckFilesPlugin(hooks: Hooks, { error, context, collectedSchemas }: NpcPluginApi) {
  hooks.transform.tapPromise('CheckFilesPlugin', async (files, group) => {
    if (collectedSchemas[group] == null) return;
    const promises: Promise<void>[] = [];
    const checkedFiles = new Set<string>();
    const ensureResourceExists = (source: string, fileName: string, resourceType?: string) => {
      if (checkedFiles.has(fileName)) return;
      checkedFiles.add(fileName);
      if (resourceType != null) {
        const names: string[] = require(`dota-data/files/resources/${resourceType}.json`);
        if (names.includes(fileName + '_c')) return;
      }

      promises.push(
        // TODO: watch for changes
        fs.pathExists(path.join(context, 'src', fileName)).then(x => {
          if (!x) error(source, `Resource ${fileName} not exists`, 'warning');
        }),
      );
    };

    _.each(files, (file, fileName) => {
      collectedSchemas[group].validateRoot(file, {
        beforeVisit: (schema, value) => {
          if (!(schema instanceof StringSchema)) return;
          if (typeof value !== 'string') return;

          if (!schema._pattern) return;
          if (!schema._pattern.test(value)) return;

          switch (String(schema._pattern)) {
            case stringResourcePatterns.particles:
              ensureResourceExists(fileName, value, 'particles');
              break;
            case stringResourcePatterns.materials:
              ensureResourceExists(fileName, value, 'materials');
              break;
            case stringResourcePatterns.models:
              ensureResourceExists(fileName, value, 'models');
              break;
            case stringResourcePatterns.soundevents:
              ensureResourceExists(
                fileName,
                value.replace(/^soundevents/, 'sounds').replace(/\.vsndevts$/, '.yml'),
                'soundevents',
              );
              break;
            case stringResourcePatterns.lua:
              const scriptPath = [
                value.startsWith('vscripts/') ? '' : 'vscripts/',
                value.replace(/\.lua$/, ''),
                '.ts',
              ].join('');
              ensureResourceExists(fileName, scriptPath);
              break;
          }
        },
      });
    });

    await Promise.all(promises);
  });
}
