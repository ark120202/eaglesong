import _ from 'lodash';

const removedItems = ['item_name'];

const data = _.mapValues<string, NpcAbilitiesOverride.Root[string]>(
  _.keyBy(removedItems),
  () => '',
);

export default data;
