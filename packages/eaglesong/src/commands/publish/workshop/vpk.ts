import execa from 'execa';
import { findSteamAppById } from 'find-steam-app';
import fs from 'fs-extra';
import globby from 'globby';
import tempWrite from 'temp-write';
import uniqueString from 'unique-string';
import path from 'upath';

const getGameFiles = (gamePath: string) => globby('**/*', { cwd: gamePath, dot: true });

const ALIEN_SWARM_SDK_APP_ID = 640;
async function findVpkBinary() {
  const alienSwarm = await findSteamAppById(ALIEN_SWARM_SDK_APP_ID);
  return path.join(alienSwarm, 'bin', 'vpk.exe');
}

export async function packAddonVpk(gamePath: string, vpkPath: string) {
  const files = await getGameFiles(gamePath);
  const listFilePath = await tempWrite(files.join('\n'));
  const vpk = await findVpkBinary();

  const vpkName = `__eaglesong__${uniqueString()}`;
  await execa(vpk, ['a', vpkName, `@${listFilePath}`], { cwd: gamePath });
  await fs.move(path.join(gamePath, `${vpkName}_dir.vpk`), vpkPath);
}
