import dateFormat from 'dateformat';

const time = (date: Date) => Math.floor(date.getTime() / 1000);
const readable = (date: Date) => dateFormat(date, 'mm/dd/yyyy hh:MM:ss TT');

// TODO: Check how title is used
export const createPublishData = (addonName: string) => {
  const publishTime = new Date();
  return `"publish_data"
{
\t"title"\t\t""
\t"source_folder"\t\t"${addonName}"
\t"publish_time"\t\t"${time(publishTime)}"
\t"publish_time_readable"\t\t"${readable(publishTime)}"
}
`;
};
