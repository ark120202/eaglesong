import tempWrite from 'temp-write';
import vdf from 'vdf-extra';

enum Visibility {
  Public = 0,
  FriendsOnly = 1,
  Private = 2,
}

interface Metadata {
  appid: number;
  /**
   * When not provided or 0 creates a new workshop item.
   */
  publishedfileid?: number;
  /**
   * A path to the directory that contains files to upload.
   *
   * When not provided or content is the same as a previous version,
   * steam won't create an update (but other fields would be updated)
   */
  contentfolder?: string;
  previewfile?: string;
  visibility?: Visibility;
  title?: string;
  description?: string;
  /**
   * When not provided or empty, steam won't append
   * `Discuss this update in the discussions section.`.
   */
  changenote?: string;
}

export async function createMetadata(contentPath: string, workshopId: number, message: string) {
  const metadata: Metadata = {
    appid: 570,
    publishedfileid: workshopId,
    contentfolder: contentPath,
    changenote: message,
  };

  return tempWrite(vdf.stringify({ '': metadata }));
}
