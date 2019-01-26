import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git/promise';
import writeJsonFile from 'write-json-file';
import writePkg from 'write-pkg';

export async function updateFiles(context: string, newVersion: string) {
  const pkg = await fs.readJson(path.join(context, 'package.json'));
  pkg.version = newVersion;
  await writePkg(context, pkg);

  const packageLockPath = path.join(context, 'package-lock.json');
  if (await fs.pathExists(packageLockPath)) {
    const packageLock = await fs.readJson(packageLockPath);
    if (packageLock.version) {
      packageLock.version = newVersion;
      await writeJsonFile(packageLockPath, packageLock, { detectIndent: true });
    }
  }
}

export async function commitFiles(context: string, commitMessage?: string, tag?: string) {
  if (commitMessage == null) {
    if (tag != null) throw new Error("Tag can't be created without a commit");
    return;
  }

  const git = simpleGit(context);
  const files = ['package.json'];
  if (await fs.pathExists(path.join(context, 'package-lock.json'))) {
    files.push('package-lock.json');
  }

  await git.add(files);
  await git.commit(commitMessage, files);
  if (tag != null) await git.addTag(tag);
}
