const { Connection, PublicKey } = require('@_koi/web3.js');
const fs = require('fs');
const path = require('path');


async function test() {
  const connection = new Connection('https://testnet.koii.live');
  const taskId = 'Cjd1Hg6N1GqCNMA35wmhS9LfsHTbSRrpBJgKLjbJtMQA'; // task ID
  let historicalData = {};
  const accountInfo = await connection.getAccountInfo(new PublicKey(taskId));
  if (!accountInfo) {
    console.log(`${taskId} doesn't contain any distribution list data`);
    return null;
  }

  const data = JSON.parse(accountInfo.data.toString());
  const payoutRecords = data.distributions_audit_record;

  let latestSuccessfulRound = findLatestSuccessfulRound(payoutRecords);
  const distributionSubmissions =
    data.distribution_rewards_submission[latestSuccessfulRound];

  const latestDistributionSubmission = findLatestDistributionSubmission(
    distributionSubmissions,
  );
  let parsed = await fetchDataFromAccount(
    latestDistributionSubmission,
    latestSuccessfulRound,
    connection,
    taskId,
  );
  //   parsed = JSON.parse(parsed);
  const storageWalletAccount = findStorageWalletAccount(parsed);
  origData = await fetchDataFromAccount(
    storageWalletAccount,
    latestSuccessfulRound,
    connection,
    taskId,
  );
  historicalData[latestSuccessfulRound] = origData;
  console.log(origData);
  let shouldBreak = false;
  while (latestSuccessfulRound >= 0) {
    console.log('latestSuccessfulRound', latestSuccessfulRound);
    console.log('origData', origData.prevRoundStorageWallet);
    const curr_storage_wallet = origData['prevRoundStorageWallet'];
    if (!curr_storage_wallet) {
      break;
    }
    latestSuccessfulRound--;
    while (latestSuccessfulRound >= 0) {
      console.log('latestSuccessfulRound', latestSuccessfulRound);
      const curr_storage_wallet_data = await fetchDataFromAccount(
        curr_storage_wallet,
        latestSuccessfulRound,
        connection,
        taskId,
      );
      if (curr_storage_wallet_data == null) {
        console.log('we reached end of the history');
        shouldBreak = true;
        break;
      }
      console.log(curr_storage_wallet_data);
      historicalData[latestSuccessfulRound] = curr_storage_wallet_data;
      origData = curr_storage_wallet_data;
      latestSuccessfulRound--;
    }
    if (shouldBreak) {
      break;
    }
  }
  try {
    const filePath = path.join(__dirname, 'HistoricalData.json');
    console.log(`Writing to: ${filePath}`);
    const historicalDataString = JSON.stringify(historicalData, null, 2);

    if (!historicalDataString) {
      console.error('No data to write.');
      return;
    }

    fs.writeFileSync(filePath, historicalDataString);
    console.log('Historical data written to file successfully.');
  } catch (error) {
    console.error('Failed to write historical data to file:', error);
  }
  return historicalData;
}

function findLatestSuccessfulRound(payoutRecords) {
  const rounds = Object.keys(payoutRecords);
  for (let j = rounds.length - 1; j >= 0; j--) {
    if (payoutRecords[rounds[j]] !== 'PayoutFailed') {
      return rounds[j];
    }
  }
  return 0;
}

async function fetchDataFromAccount(account, round, connection, taskId) {
  const storageWalletAccountInfo = await connection.getAccountInfo(
    new PublicKey(account),
  );
  const storageWalletAccountData = JSON.parse(
    storageWalletAccountInfo.data + '',
  );
  if (storageWalletAccountData[round]) {
    const bufferAccountData = Buffer.from(
      storageWalletAccountData[round][taskId],
    );

    let origData = extractOrigDataFromBuffer(bufferAccountData);
    origData = JSON.parse(origData);
    origData = JSON.parse(origData);
    return origData;
  } else return null;
}

function findLatestDistributionSubmission(distributionSubmissions) {
  let latestSlot = -Infinity;
  let latestSubmissionKey = null;

  for (const key in distributionSubmissions) {
    const slot = distributionSubmissions[key].slot;
    if (slot > latestSlot) {
      latestSlot = slot;
      latestSubmissionKey = key;
    }
  }
  return latestSubmissionKey;
}

function extractOrigDataFromBuffer(bufferData) {
  const index = bufferData.indexOf(0x00);
  const slicedBuffer = bufferData.slice(0, index);
  return JSON.stringify(new TextDecoder().decode(slicedBuffer));
}

function findStorageWalletAccount(parsed) {
  for (const key in parsed) {
    if (parsed[key] === 0) {
      return key;
    }
  }
  return null;
}

test()
  .then(historicalData => {
    if (!historicalData || Object.keys(historicalData).length === 0) {
      console.error('No historical data was returned from the test function.');
    } else {
      console.log('done', historicalData);
    }
  })
  .catch(error => {
    console.error('An error occurred during the test execution:', error);
  });
