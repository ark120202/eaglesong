import execa from 'execa';
import tar from 'tar-fs';
import tempfile from 'tempfile';

export async function makeFakeRepo(cwd: string, commit: string, paths: string[]) {
  const temporaryFilePath = tempfile();
  const git = execa('git', ['archive', commit, ...paths], { cwd });
  const extractStream = tar.extract(temporaryFilePath);
  git.stdout!.pipe(extractStream);

  await Promise.all([
    git,
    new Promise<void>((resolve, reject) => {
      extractStream.on('error', reject);
      extractStream.on('finish', resolve);
    }),
  ]);

  return temporaryFilePath;
}
