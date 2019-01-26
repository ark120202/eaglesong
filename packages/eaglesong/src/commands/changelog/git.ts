import { spawn } from 'child_process';
import tar from 'tar-fs';
import tempfile from 'tempfile';

export async function makeFakeRepo(cwd: string, commit: string, paths: string[]) {
  const tempPath = tempfile();
  const cp = spawn('git', ['archive', commit, ...paths], { cwd });
  const extractStream = tar.extract(tempPath);
  cp.stdout!.pipe(extractStream);

  let errorBuffer = '';
  cp.stderr!.on('data', buf => (errorBuffer += buf));
  await Promise.all([
    new Promise<void>((resolve, reject) =>
      // tslint:disable-next-line: no-void-expression
      cp.once('close', code => (code === 0 ? resolve() : reject(new Error(errorBuffer.trim())))),
    ),
    new Promise<void>((resolve, reject) => {
      extractStream.on('error', reject);
      extractStream.on('finish', resolve);
    }),
  ]);

  return tempPath;
}
