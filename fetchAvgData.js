const { Connection, PublicKey } = require('@_koi/web3.js');

async function test() {
  const connection = new Connection('https://testnet.koii.live');
  const taskId = '5TN6A7QGmtBT2XFpafbGiLJ1BpjoMF2XUzYnycmKWCXs'; // task ID

  const accountInfo = await connection.getAccountInfo(new PublicKey(taskId));
  if (!accountInfo) {
    console.log(`${taskId} doesn't contain any distribution list data`);
    return null;
  }

  const data = JSON.parse(accountInfo.data.toString());
  const payoutRecords = data.distributions_audit_record;

  const latestSuccessfulRound = findLatestSuccessfulRound(payoutRecords);
  const distributionSubmissions =
    data.distribution_rewards_submission[latestSuccessfulRound];

  const latestDistributionSubmission = findLatestDistributionSubmission(
    distributionSubmissions,
  );
  let distributionListDataBlob = await connection.getAccountInfo(
    new PublicKey(latestDistributionSubmission),
  );

  distributionListDataBlob = JSON.parse(
    distributionListDataBlob.data.toString(),
  );
  const bufferData = Buffer.from(
    distributionListDataBlob[latestSuccessfulRound][taskId],
  );
  let origData = extractOrigDataFromBuffer(bufferData);

  let parsed = JSON.parse(origData);
  parsed = JSON.parse(parsed);
  const storageWalletAccount = findStorageWalletAccount(parsed);

  const storageWalletAccountInfo = await connection.getAccountInfo(
    new PublicKey(storageWalletAccount),
  );
  const storageWalletAccountData = JSON.parse(
    storageWalletAccountInfo.data + '',
  );
  const bufferAccountData = Buffer.from(
    storageWalletAccountData[latestSuccessfulRound][taskId],
  );

  origData = extractOrigDataFromBuffer(bufferAccountData);
  console.log('Data received from K2', JSON.parse(origData));
  return origData;
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

test();
