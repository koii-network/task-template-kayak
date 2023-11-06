const { Web3Storage, File } = require('web3.storage');
const dataFromCid = require('../helpers/dataFromCid');
const deepEqual = require('../helpers/objectComparison');
const { namespaceWrapper } = require('../_koiiNode/koiiNode');
class Distribution {
  async submitDistributionList(round) {
    // This function just upload your generated dustribution List and do the transaction for that

    console.log('SubmitDistributionList called');

    try {
      const distributionList = await this.generateDistributionList(round);

      const decider = await namespaceWrapper.uploadDistributionList(
        distributionList,
        round,
      );
      console.log('DECIDER', decider);

      if (decider) {
        const response =
          await namespaceWrapper.distributionListSubmissionOnChain(round);
        console.log('RESPONSE FROM DISTRIBUTION LIST', response);
      }
    } catch (err) {
      console.log('ERROR IN SUBMIT DISTRIBUTION', err);
    }
  }

  async auditDistribution(roundNumber) {
    console.log('auditDistribution called with round', roundNumber);
    await namespaceWrapper.validateAndVoteOnDistributionList(
      this.validateDistribution,
      roundNumber,
    );
  }

  async computeAverages(round) {
    const db = await namespaceWrapper.getDb();
    const searchPattern = `scrape:${round}:`;

    // Construct the regular expression dynamically
    const regexPattern = new RegExp(`^${searchPattern}`);
    const itemListRaw = await db.find({ id: regexPattern });
    console.log('itemListRaw', itemListRaw);
    // Object to store averages
    const averages = {};

    // Calculate averages
    for (const item of itemListRaw) {
      const locationSummary = item.data.locationSummary;

      for (const entry of locationSummary) {
        const { location, data } = entry;

        for (const type in data) {
          if (!averages[location]) {
            averages[location] = {};
          }

          if (!averages[location][type]) {
            averages[location][type] = { count: 1, sum: data[type] };
          } else {
            averages[location][type].count++;
            averages[location][type].sum += data[type];
          }
        }
      }
    }

    // Calculate averages and update the original data
    for (const location in averages) {
      const types = averages[location];

      for (const type in types) {
        types[type] = types[type].sum / types[type].count;
      }
    }

    // Print the averages
    console.log(averages);
    return averages;
  }

  async getPreviousSubmissionWallet() {
    console.log('getPreviousSubmissionWallet called');
    const storageWallet = await namespaceWrapper.getStorageWallet();
    console.log('storageWallet', storageWallet.publicKey.toBase58());
    try {
      const taskState = await namespaceWrapper.getTaskState();
      console.log('taskState', taskState);
      let distributionSubmissionList;
      let lastDistributionRound;
      let rounds = Object.keys(taskState.distribution_rewards_submission);
      console.log('rounds', rounds);
      while (!distributionSubmissionList) {
        let latestRound = Math.max(...rounds.map(Number));
        console.log('latestRound', latestRound);
        if (latestRound === -Infinity) {
          return '';
        }
        if (
          taskState.distributions_audit_record[latestRound] ===
          'PayoutSuccessful'
        ) {
          console.log('Its inside the payout successful case');
          distributionSubmissionList =
            taskState.distribution_rewards_submission[latestRound];
          lastDistributionRound = latestRound;
          break;
        } else {
          const index = rounds.indexOf(String(latestRound));
          console.log('index', index);
          if (index > -1) {
            rounds.splice(index, 1);
            console.log('rounds after getting spliced', rounds);
          }
        }
      }
      const distributionKeys = Object.keys(distributionSubmissionList);
      let latestSubmittedSlot = 0;
      let finalDistributionAccount = '';
      for (let index = 0; index < distributionKeys.length; index++) {
        const submissionSlot =
          distributionSubmissionList[distributionKeys[index]].slot;
        if (submissionSlot > latestSubmittedSlot) {
          console.log('submissionSlot', submissionSlot);
          console.log('latestSubmittedSlot', latestSubmittedSlot);
          console.log('distributionKeys[index]', distributionKeys[index]);
          latestSubmittedSlot = submissionSlot;
          finalDistributionAccount = distributionKeys[index];
        }
      }
      if (finalDistributionAccount === '') {
        return '';
      }
      const distributionList = await namespaceWrapper.getDistributionList(
        finalDistributionAccount,
        lastDistributionRound,
      );
      console.log('distributionList', distributionList);
      let parsed = JSON.parse(distributionList);
      parsed = JSON.parse(parsed);
      const keys = Object.keys(parsed);
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        if (parsed[key] == 0) {
          console.log('key in parsed distribution list that equals 0', key);
          return key;
        }
      }
      return '';
    } catch (error) {
      console.log('ERROR IN GETTING PREVIOUS SUBMISSION WALLET', error);
      return '';
    }
  }

  async generateDistributionList(round, _dummyTaskState, isAuditing = false) {
    try {
      console.log('GenerateDistributionList called');
      console.log('I am selected node');

      // Write the logic to generate the distribution list here by introducing the rules of your choice

      /*  **** SAMPLE LOGIC FOR GENERATING DISTRIBUTION LIST ******/

      let distributionList = {};
      let distributionCandidates = [];

      if (!isAuditing) {
        const storageWallet = await namespaceWrapper.getStorageWallet();
        const averageData = await this.computeAverages(round);
        const getPreviousSubmissionWallet =
          await this.getPreviousSubmissionWallet();
        console.log('getPreviousSubmissionWallet', getPreviousSubmissionWallet);
        const cid = await this.uploadToIPFS(averageData);
        const uploadableData = {};
        uploadableData['avgData'] = cid;
        uploadableData['prevRoundStorageWallet'] = getPreviousSubmissionWallet;
        await namespaceWrapper.uploadCustomData(uploadableData, round);
        // adding the storage wallet to the distribution list
        distributionList[storageWallet.publicKey.toBase58()] = 0;
      }

      let taskAccountDataJSON = await namespaceWrapper.getTaskState();
      if (taskAccountDataJSON == null) taskAccountDataJSON = _dummyTaskState;
      const submissions = taskAccountDataJSON.submissions[round];
      const submissions_audit_trigger =
        taskAccountDataJSON.submissions_audit_trigger[round];
      if (submissions == null) {
        console.log(`No submisssions found in round ${round}`);
        return distributionList;
      } else {
        const keys = Object.keys(submissions);
        const values = Object.values(submissions);
        const size = values.length;
        console.log('Submissions from last round: ', keys, values, size);

        // Logic for slashing the stake of the candidate who has been audited and found to be false
        for (let i = 0; i < size; i++) {
          const candidatePublicKey = keys[i];
          if (
            submissions_audit_trigger &&
            submissions_audit_trigger[candidatePublicKey]
          ) {
            console.log(
              'distributions_audit_trigger votes ',
              submissions_audit_trigger[candidatePublicKey].votes,
            );
            const votes = submissions_audit_trigger[candidatePublicKey].votes;
            if (votes.length === 0) {
              // slash 70% of the stake as still the audit is triggered but no votes are casted
              // Note that the votes are on the basis of the submission value
              // to do so we need to fetch the stakes of the candidate from the task state
              const stake_list = taskAccountDataJSON.stake_list;
              const candidateStake = stake_list[candidatePublicKey];
              const slashedStake = candidateStake * 0.7;
              distributionList[candidatePublicKey] = -slashedStake;
              console.log('Candidate Stake', candidateStake);
            } else {
              let numOfVotes = 0;
              for (let index = 0; index < votes.length; index++) {
                if (votes[index].is_valid) numOfVotes++;
                else numOfVotes--;
              }

              if (numOfVotes < 0) {
                // slash 70% of the stake as the number of false votes are more than the number of true votes
                // Note that the votes are on the basis of the submission value
                // to do so we need to fetch the stakes of the candidate from the task state
                const stake_list = taskAccountDataJSON.stake_list;
                const candidateStake = stake_list[candidatePublicKey];
                const slashedStake = candidateStake * 0.7;
                distributionList[candidatePublicKey] = -slashedStake;
                console.log('Candidate Stake', candidateStake);
              }

              if (numOfVotes > 0) {
                distributionCandidates.push(candidatePublicKey);
              }
            }
          } else {
            distributionCandidates.push(candidatePublicKey);
          }
        }
      }

      // now distribute the rewards based on the valid submissions
      // Here it is assumed that all the nodes doing valid submission gets the same reward

      const reward = Math.floor(
        taskAccountDataJSON.bounty_amount_per_round /
          distributionCandidates.length,
      );
      console.log('REWARD RECEIVED BY EACH NODE', reward);
      for (let i = 0; i < distributionCandidates.length; i++) {
        distributionList[distributionCandidates[i]] = reward;
      }

      console.log(
        '***********Distribution List***************',
        distributionList,
      );
      return distributionList;
    } catch (err) {
      console.log('ERROR IN GENERATING DISTRIBUTION LIST', err);
    }
  }

  validateDistribution = async (
    distributionListSubmitter,
    round,
    _dummyDistributionList,
    _dummyTaskState,
  ) => {
    // Write your logic for the validation of submission value here and return a boolean value in response
    // this logic can be same as generation of distribution list function and based on the comparision will final object , decision can be made

    try {
      console.log('Distribution list Submitter', distributionListSubmitter);
      const rawDistributionList = await namespaceWrapper.getDistributionList(
        distributionListSubmitter,
        round,
      );

      let fetchedDistributionList;
      if (rawDistributionList == null) {
        fetchedDistributionList = _dummyDistributionList;
      } else {
        console.log('RAW DISTRIBUTION LIST', rawDistributionList);
        fetchedDistributionList = JSON.parse(rawDistributionList);
      }
      //const returnedList = await namespaceWrapper.getAverageDataFromPubKey(pubKeyReturned, round);
      console.log('FETCHED DISTRIBUTION LIST', fetchedDistributionList);
      // const generateDistributionList = await this.generateDistributionList(
      //   round,
      //   _dummyTaskState,
      //   true,
      // );

      // compare distribution list

      const parsedList = JSON.parse(fetchedDistributionList);

      // get the key whose value is 0
      let pubKeyReturned;

      for (const key in parsedList) {
        if (parsedList[key] === 0) {
          pubKeyReturned = key;
          break;
        }
      }

      console.log('pubKeyReturned', pubKeyReturned);

      // Now fetch the original list using getDistributionList

      const checkDistributionList = await namespaceWrapper.getDistributionList(
        pubKeyReturned,
        round,
      );

      const fetchedCheckDistributionList = JSON.parse(checkDistributionList);
      const parsedCheckDistributionList = JSON.parse(
        fetchedCheckDistributionList,
      );

      console.log('checkDistributionList', parsedCheckDistributionList);
      console.log(parsedCheckDistributionList.avgData);
      console.log(parsedCheckDistributionList.prevRoundStorageWallet);

      // get the average data from the cid
      const averageDataFetched = await dataFromCid(
        parsedCheckDistributionList.avgData,
      );

      console.log(
        '********averageDataFetched**********',
        averageDataFetched.data,
      );

      // comparing values

      const averageData = await this.computeAverages(round);
      console.log('******************averageData**************', averageData);

      const isEqual = await deepEqual(averageDataFetched.data, averageData);

      console.log('isEqual', isEqual);

      const getPreviousSubmissionWallet =
        await this.getPreviousSubmissionWallet();
      console.log(
        '******************getPreviousSubmissionWallet****************',
        getPreviousSubmissionWallet,
      );

      const isEqualPrevWallet =
        getPreviousSubmissionWallet ===
        parsedCheckDistributionList.prevRoundStorageWallet;

      console.log('isEqualPrevWallet', isEqualPrevWallet);

      if (isEqual && isEqualPrevWallet) {
        console.log('######################EQUAL###########');
        return true;
      }

      // console.log(
      //   'compare distribution list',
      //   parsed,
      //   generateDistributionList,
      // );
      // const result = await this.shallowEqual(parsed, generateDistributionList);
      // console.log('RESULT', result);
      //return result;
    } catch (err) {
      console.log('ERROR IN VALIDATING DISTRIBUTION', err);
      return false;
    }
  };

  async shallowEqual(parsed, generateDistributionList) {
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }

    // Normalize key quote usage for generateDistributionList
    generateDistributionList = JSON.parse(
      JSON.stringify(generateDistributionList),
    );

    const keys1 = Object.keys(parsed);
    const keys2 = Object.keys(generateDistributionList);
    if (keys1.length !== keys2.length) {
      return false;
    }

    for (let key of keys1) {
      if (parsed[key] !== generateDistributionList[key]) {
        return false;
      }
    }
    return true;
  }

  async uploadToIPFS(data) {
    const client = new Web3Storage({
      token: process.env.SECRET_WEB3_STORAGE_KEY,
    });
    const files = await this.makeFileObjects(data);
    const cid = await client.put(files);
    console.log('stored files with cid:', cid);
    return cid;
  }

  async makeFileObjects(obj) {
    const buffer = Buffer.from(JSON.stringify(obj));
    const files = [new File([buffer], 'data.json')];
    return files;
  }
}

const distribution = new Distribution();
module.exports = {
  distribution,
};
