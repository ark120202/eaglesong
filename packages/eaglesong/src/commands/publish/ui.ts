import inquirer from 'inquirer';
import * as version from './version';

export const prompt = async (question: inquirer.DistinctQuestion) =>
  (await inquirer.prompt<{ value: string }>([{ ...question, name: 'value' }])).value;

export const askForWorkshopMessage = (newVersion: string) =>
  prompt({
    // https://github.com/SBoudrias/Inquirer.js/issues/874
    type: 'input',
    message: 'Workshop Message',
    default: `v${newVersion}`,
    validate: (input) => (input === '' ? 'Empty message is not allowed' : true),
    filter: (input) => input !== '',
  });

export async function askForNewVersion(oldVersion: string) {
  const { newVersion } = await inquirer.prompt<{ newVersion: string }>([
    {
      type: 'list',
      name: 'newVersion',
      message: 'Select semver increment or specify new version',
      choices: [
        ...version.RELEASE_TYPES.map((inc) => ({
          name: `${inc} ${inc.length <= 4 ? '\t\t' : '\t'}${version.prettyDiff(oldVersion, inc)}`,
          value: inc,
        })),
        new inquirer.Separator(),
        { name: 'Other (specify)', value: null },
      ],
      filter: (input) => (version.isValidInput(input) ? version.bump(oldVersion, input) : input),
      pageSize: version.RELEASE_TYPES.length + 2,
    },
    {
      name: 'newVersion',
      message: 'Version',
      validate(input) {
        if (!version.isValidInput(input)) {
          return 'Please specify a valid semver, for example, `1.2.3`. See http://semver.org';
        }

        if (version.lt(input, oldVersion)) {
          return `Version must be greater than ${oldVersion}`;
        }

        return true;
      },
      filter: (input) => (version.isValidInput(input) ? version.bump(oldVersion, input) : input),
      when: (answers) => answers.newVersion == null,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'The addon will be published without version change. Continue?',
      when: (answers) => version.eq(answers.newVersion, oldVersion),
    },
  ]);

  return newVersion;
}
