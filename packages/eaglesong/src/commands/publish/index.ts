import bytes from 'bytes';
import chalk from 'chalk';
import simpleGit from 'simple-git/promise';
import path from 'upath';
import { CommandGroup } from '../../command';
import Builder from '../builder';
import Clean from '../clean';
import { commitFiles, updateFiles } from './files';
import { colorizeSteamFormatting } from './steam-formatting';
import { askForNewVersion, askForWorkshopMessage } from './ui';
import * as version from './version';
import { packAndUpload } from './workshop';

interface PublishUpdateInfo {
  version: string;
  oldVersion: string;
  commit?: string;
  clean?: boolean;
}

export interface PublishStrategy {
  workshopId: number;

  validate?: {
    forceBranch?: string;
    /** @default false */
    allowDirty?: boolean;
  };

  build?: {
    /** @default true */
    clean?: boolean;
  };

  /** @default true */
  bump?:
    | boolean
    | {
        /**
         * Default: vX.Y.Z
         * @default true
         */
        commit?: boolean | ((version: string) => string);

        /**
         * Default: vX.Y.Z
         * @default true
         */
        tag?: boolean | ((version: string) => string);

        /** @default true */
        push?: boolean;
      };

  workshopMessage?(args: PublishUpdateInfo): string;
  afterSuccess?(args: PublishUpdateInfo): void | Promise<void>;
}

export interface PublishOptions {
  publish?: { strategies?: Record<string, PublishStrategy> };
}

export default class PublishCommand extends CommandGroup {
  protected args!: {
    strategy: string;
    newVersion?: string;
    skipBuild: boolean;
    anyBranch: boolean;
    allowDirty: boolean;
  };

  private readonly git = simpleGit(this.context);
  private strategy!: PublishStrategy;
  private oldVersion?: string;
  private newVersion?: string;

  public register() {
    this.command({
      command: 'publish <strategy>',
      describe: 'Prepare and publish custom game to Steam Workshop',
      builder: argv =>
        argv
          .positional('strategy', { type: 'string' })
          .option('new-version', {
            describe:
              'A new version number or a release type ' +
              '(major, premajor, minor, preminor, patch, prepatch, prerelease, or same)',
            type: 'string',
          })
          .option('skip-build', {
            describe: 'Skip addon cleaning and rebuilding',
            type: 'boolean',
            default: false,
          })
          .option('any-branch', {
            describe: 'Ignore current branch check',
            type: 'boolean',
            default: false,
          })
          .option('allow-dirty', {
            describe: 'Skip checking if working tree is dirty',
            type: 'boolean',
            default: false,
          }),
      handler: () => this.publish(),
    });
  }

  private async publish() {
    const options = await this.getOptions();
    const strategies = (options.publish || {}).strategies || {};
    const strategyName = this.args.strategy;
    this.strategy = strategies[strategyName];
    if (this.strategy == null) {
      const strategyNames = Object.keys(strategies);
      const recommendation =
        strategyNames.length === 0
          ? 'Configure your strategies in a config file.'
          : `Provide one of: ${strategyNames.join(', ')}.`;

      throw new Error(`Unknown strategy name '${strategyName}'. ${recommendation}`);
    }

    await this.validate();
    await this.computeVersions();
    await this.bumpVersion();

    if (!(await this.build())) {
      process.exitCode = 1;
      return;
    }

    await this.commitVersionChanges();
    await this.uploadToWorkshop();

    if (
      this.strategy.bump !== false &&
      (this.strategy.bump == null ||
        this.strategy.bump === true ||
        this.strategy.bump.push !== false)
    ) {
      await this.git.push(undefined, undefined, ['--tags']);
    }

    if (this.strategy.afterSuccess) {
      await this.strategy.afterSuccess(await this.getUpdateInfo());
    }
  }

  private async validate() {
    if (!(await this.git.checkIsRepo())) return;

    const { allowDirty, forceBranch } = this.strategy.validate || {};
    const currentBranch = (await this.git.branchLocal()).current;

    if (forceBranch != null && currentBranch !== forceBranch && !this.args.anyBranch) {
      throw new Error(`Not on '${forceBranch}' branch. Use --any-branch to publish anyway.`);
    }

    const { remote } = await this.git.fetch(undefined, currentBranch);
    const { behind, isClean } = await this.git.status();
    if (behind > 0) {
      throw new Error(
        `Your branch is behind '${remote}/${currentBranch}' by ${behind} commits.\nIntegrate the remote changes (\`git pull\`) first.`,
      );
    }

    if (!(this.args.allowDirty || allowDirty || isClean())) {
      throw new Error(
        'Unclean working tree. Commit or stash changes first. Use --allow-dirty to publish anyway.',
      );
    }
  }

  private async computeVersions() {
    const oldVersion = (await this.getPkg()).version;
    if (!version.isValidNumber(oldVersion)) {
      throw new Error(`package.json has incorrect version ${oldVersion}`);
    }

    const versionOption = this.args.newVersion;
    let newVersion: string;
    if (this.strategy.bump !== false) {
      if (versionOption == null) {
        newVersion = await askForNewVersion(oldVersion);
      } else {
        if (!version.isValidInput(versionOption)) {
          throw new Error(
            'Please specify a valid semver, for example, `1.2.3`. See http://semver.org',
          );
        }

        newVersion = version.bump(oldVersion, versionOption);
        if (version.lt(newVersion, oldVersion)) {
          throw new Error(`Version must be greater than ${oldVersion}`);
        }

        const changed = version.neq(oldVersion, newVersion);
        console.log(`Version: ${oldVersion} ${changed ? '(not changed)' : `-> ${newVersion}`}`);
      }
    } else {
      if (versionOption != null) {
        throw new Error("--new-version option can't be used with disabled bumping");
      }

      newVersion = oldVersion;
    }

    this.oldVersion = oldVersion;
    this.newVersion = newVersion;
  }

  private async bumpVersion() {
    if (this.oldVersion == null || this.newVersion == null) throw new Error('Incorrect state');
    if (version.neq(this.oldVersion, this.newVersion)) {
      await updateFiles(this.context, this.newVersion);
    }
  }

  private async commitVersionChanges() {
    if (this.oldVersion == null || this.newVersion == null) {
      throw new Error('Incorrect state');
    }

    const bump =
      this.strategy.bump != null && this.strategy.bump !== true ? this.strategy.bump : {};
    if (bump === false) throw new Error('Incorrect state');
    if (!(await this.git.checkIsRepo())) return;

    const commitMessage =
      typeof bump.commit === 'function'
        ? bump.commit(this.newVersion)
        : bump.commit === false
        ? undefined
        : `v${this.newVersion}`;

    const tag =
      typeof bump.tag === 'function'
        ? bump.tag(this.newVersion)
        : bump.tag === false
        ? undefined
        : `v${this.newVersion}`;

    await commitFiles(this.context, commitMessage, tag);
  }

  private async build() {
    if (this.args.skipBuild) {
      console.log('Build skipped');
      return true;
    }

    const build =
      this.strategy.build != null && this.strategy.build !== true ? this.strategy.build : {};
    if (build.clean !== false) {
      await new Clean().clean();
    }

    console.log('Starting build...');
    const success = await new Builder().build();
    console.log('');
    console.log(success ? 'Build finished' : 'Build failed');

    return success;
  }

  private async uploadToWorkshop() {
    if (this.newVersion == null) throw new Error('Incorrect state');

    let workshopMessage: string;
    if (this.strategy.workshopMessage != null) {
      workshopMessage = this.strategy.workshopMessage(await this.getUpdateInfo());
      console.log(`${chalk.gray('------------')}Workshop Message${chalk.gray('------------')}`);
      console.log(colorizeSteamFormatting(workshopMessage));
      console.log(chalk.gray('----------------------------------------'));
    } else {
      workshopMessage = await askForWorkshopMessage(this.newVersion);
    }

    const dotaPath = await this.getDotaPath();
    const addonName = await this.getAddonName();
    await packAndUpload({
      addonName,
      gamePath: path.join(dotaPath, 'game', 'dota_addons', addonName),
      workshopId: this.strategy.workshopId,
      message: workshopMessage,
      beforePublish(size) {
        if (size >= 1024) {
          console.log(`Addon size: ${bytes(size, { unitSeparator: ' ' })}`);
        } else {
          throw new Error(
            `Addon size is ${bytes(size, { unitSeparator: ' ' })}. ` +
              'Most likely it means missing built files.',
          );
        }
      },
    });
  }

  private async getUpdateInfo(): Promise<PublishUpdateInfo> {
    if (this.oldVersion == null || this.newVersion == null) throw new Error('Incorrect state');

    const info: PublishUpdateInfo = { version: this.newVersion, oldVersion: this.oldVersion };
    if (await this.git.checkIsRepo()) {
      [info.commit, info.clean] = await Promise.all([
        this.git.revparse(['HEAD']),
        this.git.status().then(x => x.isClean()),
      ]);
    }

    return info;
  }
}
