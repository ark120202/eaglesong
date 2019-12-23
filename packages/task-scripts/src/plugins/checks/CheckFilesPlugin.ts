import { StringSchema } from 'dota-data/lib/schema';
import { resourcePatterns } from 'dota-data/lib/schemas';
import fs from 'fs-extra';
import _ from 'lodash';
import path from 'path';
import { getGroupSchema, Plugin } from '../../plugin';

const stringResourcePatterns = _.mapValues(resourcePatterns, String);

export const CheckFilesPlugin: Plugin = ({ hooks, error, context, collectedSchemas }) => {
  hooks.transform.tapPromise('CheckFilesPlugin', async (files, group) => {
    const schema = getGroupSchema(collectedSchemas, group);
    if (schema == null) return;

    const promises: Promise<void>[] = [];
    const checkedFiles = new Set<string>();
    function ensureResourceExists(fileName: string, resourcePath: string, resourceType?: string) {
      if (checkedFiles.has(resourcePath)) return;
      checkedFiles.add(resourcePath);
      if (resourceType != null) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const names: string[] = require(`dota-data/files/resources/${resourceType}.json`);
        if (names.includes(`${resourcePath}_c`)) return;
      }

      promises.push(
        // TODO: watch for changes
        (async () => {
          const exists = await fs.pathExists(path.join(context, 'src', resourcePath));
          if (!exists) {
            error({
              fileName,
              level: 'warning',
              message: `Resource '${resourcePath}' not exists`,
            });
          }
        })(),
      );
    }

    _.each(files, (file, fileName) => {
      schema.validateRoot(file, {
        beforeVisit(element, value) {
          if (!(element instanceof StringSchema)) return;
          if (typeof value !== 'string') return;

          if (!element._pattern) return;
          if (!element._pattern.test(value)) return;

          switch (String(element._pattern)) {
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
            case stringResourcePatterns.lua: {
              let scriptPath = `${value.replace(/\.lua$/, '')}.ts`;
              if (!scriptPath.startsWith('vscripts/')) {
                scriptPath = `vscripts/${scriptPath}`;
              }

              ensureResourceExists(fileName, scriptPath);
              break;
            }
          }
        },
      });
    });

    await Promise.all(promises);
  });
};
