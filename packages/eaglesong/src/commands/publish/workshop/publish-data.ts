import dateFormat from 'dateformat';

const time = (date: Date) => Math.floor(date.getTime() / 1000);
const readable = (date: Date) => dateFormat(date, 'mm/dd/yyyy hh:MM:ss TT');

// TODO: Check how title is used
export const createPublishData = (addonName: string) => {
  const publishTime = new Date();
  return `"publish_data"
{
	"title"		""
	"source_folder"		"${addonName}"
	"publish_time"		"${time(publishTime)}"
	"publish_time_readable"		"${readable(publishTime)}"
}
`;
};
