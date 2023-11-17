const fetchWithTimeout = require('./fetchWithTimeout');

module.exports = async (cid, fileName) => {
  console.log('use IPFS HTTP gateway');

  const listOfIpfsGatewaysUrls = [
    `https://ipfs.io/ipfs/${cid}/${fileName}`,
    `https://${cid}.ipfs.w3s.link/${fileName}`,
    `https://gateway.ipfs.io/ipfs/${cid}/${fileName}`,
    `https://ipfs.eth.aragon.network/ipfs/${cid}/${fileName}`,
  ];

  for (const url of listOfIpfsGatewaysUrls) {
    try {
      const response = await fetchWithTimeout(url);
      const fileContent = await response.text();
      const couldNotFetchActualFileContent =
        fileContent.startsWith('<!DOCTYPE html>');

      if (!couldNotFetchActualFileContent) {
        return fileContent;
      }

      console.log(`Gateway failed at ${url}, trying next if available.`);
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error);
    }
  }

  throw Error(`Failed to get ${cid} from IPFS`);
};
