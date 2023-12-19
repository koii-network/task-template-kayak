const e = require('express');
const { namespaceWrapper } = require('../_koiiNode/koiiNode');
const dataFromCid = require('../helpers/dataFromCid');
const deepEqual = require('../helpers/submissionComparison');

class Audit {
  async validateNode(submission_value, round) {
    try {
      console.log('inside validateNode');

      // GET THE DATA FROM CID AND VALIDATE IT
      const originalData = await dataFromCid(submission_value);
      console.log('originalData', originalData.data);

      // GET THE SUBMISSION VALUE FROM DB

      const originalItem = originalData.data[0];

      const itemData = await dataFromCid(originalItem.cid);
      console.log('itemData', itemData.data);

      // GET THE DATA FROM DB

      const db = await namespaceWrapper.getDb();

      const searchPattern = `scrapeCidAverageData:${round}`;
      const itemListRaw = await db.find({ id: searchPattern });
      console.log('**********AVERAGE DATA*********', itemListRaw);
      const matchingItem = await dataFromCid(itemListRaw[0].cid);

      console.log('matchingItem', matchingItem.data);

      // ************* FOR TESTING  ************ //

      // const matchingItem = {
      //   data: {
      //     Denver: {
      //       Economy: 20,
      //       Compact: 20,
      //       Intermediate: 14,
      //       Standard: 12,
      //       'Standard SUV': 26,
      //     },
      //     Boston: {
      //       Economy: 23,
      //       Compact: 23,
      //       Intermediate: 23,
      //       Standard: 24,
      //       'Standard SUV': 27,
      //     },
      //     Brooklyn: {
      //       Economy: 28,
      //       Compact: 29,
      //       Intermediate: 32,
      //       Standard: 30,
      //       'Standard SUV': 35,
      //     },
      //     Chicago: {
      //       Economy: 33,
      //       Compact: 13,
      //       Intermediate: 13,
      //       Standard: 27,
      //       'Standard SUV': 32,
      //     },
      //     Seattle: {
      //       Economy: 16,
      //       Compact: 16,
      //       Intermediate: 18,
      //       Standard: 24,
      //       'Standard SUV': 30,
      //     },
      //     Miami: {
      //       Economy: 6,
      //       Compact: 6,
      //       Intermediate: 7,
      //       Standard: 10,
      //       'Standard SUV': 13,
      //     },
      //     'Washington, D.C.': {
      //       Economy: 23,
      //       Compact: 23,
      //       Intermediate: 23,
      //       Standard: 26,
      //       'Standard SUV': 26,
      //     },
      //     'Los Angeles': {
      //       Economy: 13,
      //       Compact: 13,
      //       Intermediate: 11,
      //       Standard: 16,
      //       'Standard SUV': 17,
      //     },
      //   },
      // };

      const threshold = 20;

      const isEqual = await deepEqual(
        itemData.data,
        matchingItem.data,
        threshold,
      );

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
