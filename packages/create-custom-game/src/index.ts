#!/usr/bin/env node
import execa from 'execa';
import fs from 'fs-extra';
import globby from 'globby';
import inquirer from 'inquirer';
import path from 'path';
import sortPackageJson from 'sort-package-json';
import yargs from 'yargs';

async function prompt(question: inquirer.Question) {
  const { value } = await inquirer.prompt<{ value: any }>([{ ...question, name: 'value' }]);
  await new Promise<void>(resolve => setImmediate(resolve));
  return value;
}

async function promptString(question: inquirer.InputQuestion<inquirer.Answers>): Promise<string> {
  return prompt(question);
}

async function promptConfirmation(message: string, defaultValue?: boolean): Promise<boolean> {
  return prompt({ type: 'confirm', message, default: defaultValue });
}

const isYarnAvailable = (() => {
  try {
    execa.sync('yarnpkg --version');
    return true;
  } catch (e) {
    return false;
  }
})();

const isGitAvailable = (() => {
  try {
    execa.sync('git --version');
    return true;
  } catch (e) {
    return false;
  }
})();

(async () => {
  const argv = yargs
    .alias('h', 'help')
    .alias('v', 'version')
    .locale('en')
    .usage('Usage: $0')
    .boolean('use-npm')
    .default('use-npm', false)
    .describe('use-npm', 'Use npm to install dependencies even if `yarn` is found')
    .boolean('no-git')
    .default('no-git', false)
    .describe('no-git', "Don't initialize git repository even if `git` is found")
    .strict()
    .parse();

  const transformInternalName = (input: string) =>
    input
      .toLowerCase()
      .replace(/ ?& ?/g, '-and-')
      .replace(/[_ ]/g, '-')
      .replace(/[^a-z\d-]/g, '');

  const validateInternalName = async (name: string) => {
    if (name === '') return "Name shouldn't be empty";
    if (await fs.pathExists(name)) {
      if (!(await fs.stat(name)).isDirectory) {
        return 'A file with that name already exists';
      }

      if ((await fs.readdir(name)).length !== 0) {
        return "A directory with that name already exists and it's not empty";
      }
    }

    return true;
  };

  const displayName = await promptString({ message: 'Display Name:' });
  const internalName = await promptString({
    message: 'Internal Name:',
    validate: validateInternalName,
    transformer: transformInternalName,
    default: transformInternalName(displayName),
  });

  const conventionalCommits = await promptConfirmation('Use conventional commits?', true);
  const includeExamples = await promptConfirmation('Include examples?', true);

  const useGit = isGitAvailable && !argv['no-git'];

  const packageManager = isYarnAvailable && !argv['use-npm'] ? 'yarnpkg' : 'npm';
  const runPackageManager = (args: string[]) =>
    execa(packageManager, args, { stdio: 'inherit', cwd: internalName });
  const outputFile = (filePath: string, content: string) =>
    fs.outputFile(path.join(internalName, filePath), content);
  const outputJson = (filePath: string, data: any) =>
    fs.outputJson(path.join(internalName, filePath), data, { spaces: 2 });

  const packageJson: Record<string, any> = {
    name: internalName,
    version: '1.0.0',
    private: true,
    scripts: {
      build: 'node ../packages/cli/bin/eaglesong.js build',
      ci: 'node ../packages/cli/bin/eaglesong.js ci --push-localization',
      clean: 'node ../packages/cli/bin/eaglesong.js clean',
      dev: 'node ../packages/cli/bin/eaglesong.js dev',
      eaglesong: 'node ../packages/cli/bin/eaglesong.js',
      launch: 'node ../packages/cli/bin/eaglesong.js launch',
      release: 'node ../packages/cli/bin/eaglesong.js publish --preset release',
    },
  };

  const dependencies = [
    '@types/node',
    'types-dota-panorama',
    'dota-lua-types',
    'link:D:/dev/dota/_modules/panorama-polyfill',
  ];

  const devDependencies = ['typescript', 'tslint', 'tslint-config-prettier'];

  const templates = new Set(['base']);

  if (useGit) {
    templates.add('git');
    await execa('git', ['init'], { cwd: internalName });
  }

  if (!true) {
    templates.add('test');
    devDependencies.push('jest', '@types/jest', 'ts-jest');
    packageJson.scripts.test = 'jest';
    packageJson.jest = {
      projects: ['<rootDir>/src/vscripts.test', '<rootDir>/src/panorama.test'],
    };

    if (includeExamples) {
      templates.add('test-examples');
    }
  }

  if (conventionalCommits) {
    templates.add('conventional-commits');
    devDependencies.push('husky', '@commitlint/cli', '@commitlint/config-conventional');
    packageJson.husky = { hooks: { 'commit-msg': 'commitlint -E HUSKY_GIT_PARAMS' } };
    packageJson.commitlint = { extends: '@commitlint/config-conventional' };
  }

  if (includeExamples) {
    templates.add('examples');
    dependencies.push('lodash', '@types/lodash', 'date-fns@next');
  }

  await Promise.all(
    [...templates].map(async template => {
      const rootPath = path.join(__dirname, '..', 'templates', template);
      const files = await globby('**/*', { cwd: rootPath, dot: true });
      await Promise.all(
        files.map(async fileName => {
          let fileContent = await fs.readFile(path.join(rootPath, fileName), 'utf8');
          if (fileName.endsWith('.ts')) {
            fileContent = fileContent.replace(/\/\/ if (.+?): (.+)/g, (_, condition, expression) =>
              templates.has(condition) ? expression : '',
            );
          }

          // See: https://github.com/npm/npm/issues/1862
          if (fileName === '_gitignore') fileName = '.gitignore';
          await outputFile(fileName, fileContent);
        }),
      );
    }),
  );

  packageJson.dependencies = dependencies;
  packageJson.devDependencies = devDependencies;
  await outputJson('package.json', sortPackageJson(packageJson));
  try {
    await runPackageManager(['install']);
  } catch {
    throw { message: 'Failed to install dependencies' };
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
