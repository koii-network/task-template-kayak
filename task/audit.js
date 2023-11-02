const e = require('express');
const { namespaceWrapper } = require('../_koiiNode/koiiNode');
const dataFromCid = require('../helpers/dataFromCid');

class Audit {
  async validateNode(submission_value, round) {
    console.log('inside validateNode');
    console.log('submission_value', submission_value);
    console.log('round', round);

    // GET THE DATA FROM CID AND VALIDATE IT

    const originalData = await dataFromCid(submission_value);
    console.log('originalData', originalData.data);

    // GET THE SUBMISSION VALUE FROM DB

    const db = await namespaceWrapper.getDb();
    const searchPattern = `scrape:${round}:`;

    // Construct the regular expression dynamically
    const regexPattern = new RegExp(`^${searchPattern}`);
    const itemListRaw = await db.find({ id: regexPattern });
    console.log('itemListRaw', itemListRaw);

    // check if the id is same in both the data

    //const parsedData = JSON.parse(originalData[0]);

    const originalItem = originalData.data[0];
    console.log('originalItem', originalItem.id);

    const matchingItem = itemListRaw[0];
    console.log('matchingItem', matchingItem.id);

    // Check if the "id" field is equal
    if (originalItem.id === matchingItem.id) {
      console.log('ID MATCH FOUND');

      // now let us comapare 
    } else {
      console.log('DO NOTHING');
    }

    // Write your logic for the validation of submission value here and return a boolean value in response

    // // The sample logic can be something like mentioned below to validate the submission
    // let vote;
    // console.log('SUBMISSION VALUE', submission_value, round);
    // try {
    //   if (submission_value == 'Hello, World!') {
    //     // For successful flow we return true (Means the audited node submission is correct)
    //     vote = true;
    //   } else {
    //     // For unsuccessful flow we return false (Means the audited node submission is incorrect)
    //     vote = false;
    //   }
    // } catch (e) {
    //   console.error(e);
    //   vote = false;
    // }
    // return vote;
    //return true;
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
