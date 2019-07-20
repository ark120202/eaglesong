import fs from 'fs-extra';
import yaml from 'js-yaml';
import parseJson from 'json-parse-better-errors';
import _ from 'lodash';
import stripJsonComments from 'strip-json-comments';
import path from 'upath';

export async function _import(id: string): Promise<any> {
  const extension = path.extname(id);

  switch (extension) {
    case '.yml':
    case '.yaml': {
      const content = await fs.readFile(id, 'utf8');
      const result = yaml.safeLoad(content, { filename: id });
      return result != null ? result : {};
    }

    case '.json': {
      const content = await fs.readFile(id, 'utf8');
      return parseJson(stripJsonComments(content));
    }

    case '.ts':
    case '.tsx':
    case '.jsx':
      // eslint-disable-next-line node/no-deprecated-api
      if (require.extensions['.ts'] == null) {
        // Type checking and linting is done in a plugin
        (await import('ts-node')).register({ transpileOnly: true });
      }
    // fallthrough
    case '.js': {
      const resolved = require.resolve(id);
      // TODO: Consider using decache
      delete require.cache[resolved];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const result = require(resolved);
      const copy = _.clone(result);
      if (result.__esModule) copy.__esModule = true;
      return copy;
    }

    default:
      throw new Error(`Extension ${extension} is not supported`);
  }
}
