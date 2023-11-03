const e = require('express');
const { namespaceWrapper } = require('../_koiiNode/koiiNode');
const dataFromCid = require('../helpers/dataFromCid');
const deepEqual = require('../helpers/objectComparison');

class Audit {
  async validateNode(submission_value, round) {
    try {
      console.log('inside validateNode');

      // GET THE DATA FROM CID AND VALIDATE IT
      const originalData = await dataFromCid(submission_value);
      console.log('originalData', originalData.data);

      // GET THE SUBMISSION VALUE FROM DB

      const db = await namespaceWrapper.getDb();
      const searchPattern = `scrape:${round}:`;

      // Construct the regular expression dynamically
      const regexPattern = new RegExp(`^${searchPattern}`);
      const itemListRaw = await db.find({ id: 'edvwev' });
      console.log('itemListRaw', itemListRaw);

      // check if the data is same as the original data

      const originalItem = originalData.data[0];
      const matchingItem = itemListRaw[0];

      const itemData = await dataFromCid(originalItem.cid);
      const isEqual = await deepEqual(itemData.data, matchingItem.data);

      console.log('isEqual', isEqual);
      if (isEqual) {
        console.log('EQUAL');
        return true;
      } else {
        console.log('NOT EQUAL');
        return false;
      }
    } catch (error) {
      console.log('ERROR IN AUDIT SUBMISSION', error);
      return undefined;
    }
  }

  async auditTask(roundNumber) {
    console.log('auditTask called with round', roundNumber);
    console.log(
      await namespaceWrapper.getSlot(),
      'current slot while calling auditTask',
    );
    await namespaceWrapper.validateAndVoteOnNodes(
      this.validateNode,
      roundNumber,
    );
  }
}
const audit = new Audit();
module.exports = { audit };
