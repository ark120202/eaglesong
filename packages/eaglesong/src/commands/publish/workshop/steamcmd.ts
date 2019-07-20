import execa from 'execa';
import { prompt } from '../ui';

async function getPassword() {
  const password = process.env.STEAMCMD_PASSWORD;
  if (password) return password;

  if (!process.stdin.isTTY) {
    throw new Error('Provide a Steam password with a STEAMCMD_PASSWORD environment variable');
  }

  return prompt({
    type: 'password',
    message: 'Password:',
    validate: x => x !== '',
    mask: '*',
  });
}

async function getGuardCode() {
  if (!process.stdin.isTTY) throw new Error('Disable Steam Guard or run this command with a tty');

  return prompt({ message: 'Steam Guard code:', filter: v => v.toUpperCase() });
}

export async function uploadToSteam(metadataPath: string, workshopId: number) {
  let login = process.env.STEAMCMD_LOGIN;
  if (login == null && process.stdin.isTTY) {
    login = await prompt({
      // FIXME: TS can't choose between InputQuestion and NumberQuestion for validate
      type: 'input',
      message: 'Login:',
      validate: x => x !== '',
    });
  } else if (login == null || login === '') {
    throw new Error('Provide a Steam login with a STEAMCMD_LOGIN environment variable');
  }

  let child: execa.ExecaChildProcess;
  try {
    child = execa('steamcmd', ['+login', login, '+workshop_build_item', metadataPath, '+quit']);
  } catch (error) {
    throw error.code === 'ENOENT' ? new Error('SteamCMD binary not found') : error;
  }

  let childStdout = '';
  child.stdout!.on('data', async (buf: Buffer) => {
    childStdout += buf.toString();

    if (childStdout.trimRight().endsWith('password:')) {
      child.stdin!.write(`${await getPassword()}\n`);
    }

    if (childStdout.trimRight().endsWith('Steam Guard code:')) {
      child.stdin!.write(`${await getGuardCode()}\n`);
    }
  });

  try {
    await child;
  } catch (error) {
    const { stdout } = error as execa.ExecaError;

    if (stdout.includes('Login Failure: Invalid Password')) throw new Error('Invalid Password');
    if (stdout.includes('ERROR! Failed to update workshop item (Access Denied)')) {
      throw new Error(
        'Access Denied. Make sure you are a contributor of ' +
          `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}.`,
      );
    }

    throw error;
  }
}
