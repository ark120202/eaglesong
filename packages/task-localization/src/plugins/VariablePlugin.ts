import _ from 'lodash';
import { Plugin } from '../service';
import { FlatLocalizationFiles } from '../types';

const VARIABLE_REGEXP = /\${(.+?)}/g;

function findString(files: FlatLocalizationFiles, token: string) {
  for (const [fileName, file] of Object.entries(files)) {
    if (file[token] != null) {
      return { fileName, value: file[token] };
    }
  }
}

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

export const VariablePlugin: Plugin = (hooks, { error: addError }) => {
  function localize(
    files: FlatLocalizationFiles,
    fileName: string,
    key: string,
    value: string,
    keyStack: string[],
  ) {
    const firstKey = _.defaultTo(keyStack[0], key);
    return value.replace(VARIABLE_REGEXP, (fullMatch: string, expression: string) => {
      const [variable, ...filters] = expression.split(' | ');
      const found = findString(files, variable);
      if (found == null) {
        addError(fileName, `${firstKey} > can't resolve variable "${variable}"`, 'warning');
        return fullMatch;
      }

      let variableValue = found.value;
      if (VARIABLE_REGEXP.test(variableValue)) {
        if (keyStack.includes(key)) {
          addError(fileName, `${firstKey} > recursive variable "${variable}"`);
          return fullMatch;
        }

        keyStack.push(key);
        variableValue = localize(files, found.fileName, variable, variableValue, keyStack);
      }

      for (const filterExpression of filters) {
        const [, filterName, rawFilterParametersExpression] = filterExpression.match(
          /([^ ]*)(?: (.*))?/,
        )!;

        let filterParameters: unknown[];
        try {
          filterParameters = rawFilterParametersExpression
            ? JSON.parse(`[${rawFilterParametersExpression}]`)
            : [];
        } catch (error) {
          addError(
            fileName,
            `${firstKey} > filter '${filterName}' has invalid parameters:\n  ${error.message}`,
          );
          continue;
        }

        const filter = defaultFilters[filterName];
        if (filter != null) {
          const result = filter(variableValue, filterParameters);
          if (typeof result === 'string') {
            variableValue = result;
          } else {
            addError(
              fileName,
              `${firstKey} > error applying '${filterName}' filter: ${result.error}`,
            );
          }
        } else {
          addError(fileName, `${firstKey} > unknown filter '${filterName}'`);
        }
      }

      return variableValue;
    });
  }

  hooks.postprocess.tap('VariablePlugin', files => {
    _.each(files, (file, fileName) =>
      _.each(file, (value, key) => {
        file[key] = localize(files, fileName, key, value, []);
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
