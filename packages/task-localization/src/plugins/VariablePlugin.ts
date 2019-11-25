import { getLocalization } from 'dota-data/lib/localization';
import _ from 'lodash';
import path from 'upath';
import { Plugin } from '../service';
import { DotaLanguage, FlatLocalizationFiles } from '../types';

type Filter = (value: string, parameters: unknown[]) => string | { error: string };
const defaultFilters: Record<string, Filter> = {
  upper(value, parameters) {
    if (parameters.length > 0) return { error: 'No parameters expected' };

    return value.toUpperCase();
  },

  lower(value, parameters) {
    if (parameters.length > 0) return { error: 'No parameters expected' };

    return value.toLowerCase();
  },

  reverse(value, parameters) {
    if (parameters.length > 0) return { error: 'No parameters expected' };

    return [...value].reverse().join('');
  },

  slice(value, parameters) {
    if (parameters.length !== 2) return { error: 'expects 2 parameters' };
    const [start, end] = parameters;

    if (typeof start !== 'number' || !Number.isInteger(start)) {
      return { error: `Parameter 1 should be an integer, got ${typeof start}` };
    }

    if (typeof end !== 'number' || !Number.isInteger(start)) {
      return { error: `Parameter 2 should be an integer, got ${typeof end}` };
    }

    return value.slice(start, end);
  },

  replace(value, parameters) {
    if (parameters.length !== 2) return { error: '2 parameters expected' };
    const [searchValue, replaceValue] = parameters;

    if (typeof searchValue !== 'string') {
      return { error: `Parameter 1 should be a string, got ${typeof searchValue}` };
    }

    if (typeof replaceValue !== 'string') {
      return { error: `Parameter 2 should be a string, got ${typeof replaceValue}` };
    }

    return value.replace(searchValue, replaceValue);
  },
};

function applyFilter(variableValue: string, filterExpression: string) {
  const [, filterName, rawFilterParametersExpression] = filterExpression.match(
    /([^ ]*)(?: (.*))?/,
  )!;

  let filterParameters: unknown[];
  try {
    filterParameters = rawFilterParametersExpression
      ? JSON.parse(`[${rawFilterParametersExpression}]`)
      : [];
  } catch (error) {
    return { error: `filter '${filterName}' has invalid parameters:\n  ${error.message}` };
  }

  const filter = defaultFilters[filterName];
  if (filter == null) {
    return { error: `unknown filter '${filterName}'` };
  }

  const result = filter(variableValue, filterParameters);
  if (typeof result !== 'string') {
    return { error: `error applying '${filterName}' filter: ${result.error}` };
  }

  return result;
}

const VARIABLE_REGEXP = /\${(.+?)}/g;

function findString(files: FlatLocalizationFiles, token: string) {
  for (const [fileName, file] of Object.entries(files)) {
    if (file[token] != null) {
      return { fileName, value: file[token] };
    }
  }
}

const fetchedLanguages = new Map<DotaLanguage, Record<string, string>>();
export const VariablePlugin: Plugin = ({ hooks, error: addError, context }) => {
  hooks.postprocess.tapPromise('VariablePlugin', async (files, language) => {
    function localize(fileName: string, key: string, value: string, keyStack: string[]) {
      const firstKey = _.defaultTo(keyStack[0], key);
      const isFirstKey = keyStack.length === 0;
      return value.replace(VARIABLE_REGEXP, (fullMatch: string, expression: string) => {
        let variableValue: string;
        const [variable, ...filters] = expression.split(' | ');
        if (variable.startsWith('dota:')) {
          const dotaLocalization = fetchedLanguages.get(language);
          if (dotaLocalization == null) {
            throw new Error(`Data for language '${language}' not found`);
          }

          const rawToken = variable.slice(5);
          variableValue = dotaLocalization[rawToken];
          if (variableValue == null) {
            if (isFirstKey) {
              addError({
                fileName,
                level: 'warning',
                message: `${key}: cannot resolve dota variable '${rawToken}'`,
              });
            }

            return fullMatch;
          }
        } else {
          const found = findString(files, variable);
          if (found == null) {
            if (isFirstKey) {
              addError({
                fileName,
                level: 'warning',
                message: `${key}: cannot resolve variable '${variable}'`,
              });
            }

            return fullMatch;
          }

          variableValue = found.value;
          if (VARIABLE_REGEXP.test(variableValue)) {
            if (keyStack.includes(key)) {
              const keyPath = [...keyStack.slice(1), key].join(' > ');
              addError({ fileName, message: `${firstKey}: recursive variable '${keyPath}'` });
              return fullMatch;
            }

            keyStack.push(key);
            variableValue = localize(found.fileName, variable, variableValue, keyStack);
          }
        }

        for (const filterExpression of filters) {
          const result = applyFilter(variableValue, filterExpression);
          if (typeof result === 'string') {
            variableValue = result;
          } else if (isFirstKey) {
            addError({ fileName, message: `${key}: ${result.error}` });
          }
        }

        return variableValue;
      });
    }

    const usesDotaVariables = Object.values(files)
      .flatMap(file => Object.values(file))
      .flatMap(value => [...value.matchAll(VARIABLE_REGEXP)])
      .some(([, expression]) => {
        const [variable] = expression.split(' | ');
        return variable.startsWith('dota:');
      });

    if (usesDotaVariables && !fetchedLanguages.has(language)) {
      const cachePath = path.join(context, 'node_modules/.cache/dota-data/localization');
      fetchedLanguages.set(
        language,
        await getLocalization(language, { cache: { path: cachePath } }),
      );
    }

    _.each(files, (file, fileName) =>
      _.each(file, (value, key) => {
        file[key] = localize(fileName, key, value, []);
      }),
    );
  });

  // Don't localize strings consisting only of variables
  hooks.push.tap('VariablePlugin', files =>
    _.each(files, file =>
      _.each(file, (value, key) => {
        if (value.replace(VARIABLE_REGEXP, '').replace(/\s/g, '').length === 0) {
          delete file[key];
        }
      }),
    ),
  );
};
