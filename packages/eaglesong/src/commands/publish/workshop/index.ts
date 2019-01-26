import fs from 'fs-extra';
import tempfile from 'tempfile';
import path from 'upath';
import { createMetadata } from './metadata';
import { createPublishData } from './publish-data';
import { uploadToSteam } from './steamcmd';
import { packAddonVpk } from './vpk';

export async function packAndUpload(args: {
  addonName: string;
  gamePath: string;
  workshopId: number;
  message: string;
  beforePublish?(size: number): void;
}) {
  if (args.workshopId < 1) throw new Error('Invalid workshop id');

  const contentDirectory = path.toUnix(tempfile());
  try {
    await fs.emptyDir(contentDirectory);

    const vpkPath = path.join(contentDirectory, `${args.workshopId}.vpk`);
    await packAddonVpk(args.gamePath, vpkPath);

    const publishData = createPublishData(args.addonName);
    await fs.outputFile(path.join(contentDirectory, 'publish_data.txt'), publishData);

    const metadataPath = await createMetadata(contentDirectory, args.workshopId, args.message);

    const { size } = await fs.stat(vpkPath);
    if (args.beforePublish) args.beforePublish(size + Buffer.byteLength(publishData));

    try {
      await uploadToSteam(metadataPath, args.workshopId);
    } finally {
      await fs.remove(contentDirectory);
    }
  } finally {
    await fs.remove(contentDirectory);
  }
}
