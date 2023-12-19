// Import required modules
const puppeteer = require('puppeteer');
const PCR = require('puppeteer-chromium-resolver');
const cheerio = require('cheerio');
var crypto = require('crypto');
const axios = require('axios');
const { Web3Storage, File } = require('web3.storage');
const Data = require('../../model/data');
const { namespaceWrapper } = require('../../_koiiNode/koiiNode');

/**
 * Twitter
 * @class
 * @extends Adapter
 * @description
 * Provides a crawler interface for the data gatherer nodes to use to interact with twitter
 */

class Kayak {
  desiredLocations = [
    'Los Angeles',
    'Denver',
    'Boston',
    'Seattle',
    'Brooklyn',
    'Miami',
    'Washington, D.C.',
    'Chicago',
  ]; // List of desired locations
  desiredCarTypes = [
    'Economy',
    'Compact',
    'Intermediate',
    'Standard',
    'Standard SUV',
  ]; // List of desired car types

  constructor() {
    this.locationDb = new Data('locationDb', []);
    this.locationDb.initializeData();
    this.proofs = new Data('proofs', []);
    this.proofs.initializeData();
    this.cids = new Data('cids', []);
    this.cids.initializeData();
    this.toCrawl = [];
    this.parsed = {};
    this.lastSessionCheck = null;
    this.sessionValid = false;
    this.browser = null;
  }

  /**
   * checkSession
   * @returns {Promise<boolean>}
   * @description
   * 1. Check if the session is still valid
   * 2. If the session is still valid, return true
   * 3. If the session is not valid, check if the last session check was more than 1 minute ago
   * 4. If the last session check was more than 1 minute ago, negotiate a new session
   */
  checkSession = async () => {
    if (this.sessionValid) {
      return true;
    } else if (Date.now() - this.lastSessionCheck > 50000) {
      await this.negotiateSession();
      return true;
    } else {
      return false;
    }
  };

  /**
   * negotiateSession
   * @returns {Promise<void>}
   * @description
   * 1. Get the path to the Chromium executable
   * 2. Launch a new browser instance
   * 3. Open a new page
   * 4. Set the viewport size
   * 5. Queue twitterLogin()
   */
  negotiateSession = async () => {
    await this.sleep(5000);
    console.log('negotiating session');
    let locationDataList = await this.locationDb.getItem({
      id: 'locationData',
    });
    console.log('locationDataList', locationDataList);
    if (!locationDataList || locationDataList[0].data.length == 0) {
      await this.getLinksForDifferentCarLocations();
    }
    this.sessionValid = true;
    this.lastSessionCheck = Date.now();
    return true;
  };

  getLinksForDifferentCarLocations = async () => {
    const options = {};
    const stats = await PCR(options);
    console.log(
      '*****************************************CALLED PURCHROMIUM RESOLVER*****************************************',
    );
    this.browser = await stats.puppeteer.launch({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      executablePath: stats.executablePath,
    });

    console.log('Step: Open new page');
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );
    // TODO - Enable console logs in the context of the page and export them for diagnostics here
    await this.page.setViewport({ width: 1920, height: 1080 });
    this.page.goto('https://www.kayak.com/cars');
    await this.page.waitForTimeout(5000);
    const elements = await this.page.$$('div.P_Ok-container > h3');

    const filteredResult = await Promise.all(
      elements.map(async element => {
        const href = await element.$eval('a.P_Ok-main-link', a => a.href);
        const text = await element.$eval('a.P_Ok-main-link', a =>
          a.textContent.replace(' Rental Cars', ''),
        );

        if (this.desiredLocations.includes(text)) {
          return { href, text };
        } else {
          return null; // Exclude the item from the result
        }
      }),
    );

    const modifiedResult = filteredResult.filter(item => item !== null);
    const locationData = {
      id: 'locationData',
      data: modifiedResult,
    };
    await this.locationDb.create(locationData);
    console.log(modifiedResult);
    await this.browser.close();
    this.browser = null;
  };

  storeAverageData = async (round, cid) => {
    await this.cids.create({
      id: 'scrapeCidAverageData:' + round,
      round: round,
      cid: cid,
    });
  };

  /**
   * getSubmissionCID
   * @param {string} round - the round to get the submission cid for
   * @returns {string} - the cid of the submission
   * @description - this function should return the cid of the submission for the given round
   * if the submission has not been uploaded yet, it should upload it and return the cid
   */
  getSubmissionCID = async round => {
    if (this.proofs) {
      // we need to upload proofs for that round and then store the cid
      // const data = await distribution.computeAverages(round);

      // console.log('DATA FROM GET SUBMISSIONCID', data);

      // GET THE DATA FROM THE DATABASE

      //console.log('CHECK', `scrapeCidAverageData: + ${round}`);

      // const data = await namespaceWrapper.storeGet(
      //   'scrapeCidAverageData:' + `${round}`,
      // );

      const data = await this.cids.getAverageList({ round: round });

      console.log('DATA FROM GET SUBMISSIONCID', data);

      if (data && data.length === 0) {
        console.log('No cids found for round ' + round);
        return null;
      } else {
        const listBuffer = Buffer.from(JSON.stringify(data));
        const listFile = new File([listBuffer], 'data.json', {
          type: 'application/json',
        });
        // TEST USE
        const client = makeStorageClient();
        const cid = await client.put([listFile]);
        // const cid = "cid"
        await this.proofs.create({
          id: 'proof:' + round,
          proof_round: round,
          proof_cid: cid,
        });

        console.log('returning proof cid for submission', cid);
        return cid;
      }
    } else {
      throw new Error('No proofs database provided');
    }
  };

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  convertToTimestamp = async dateString => {
    const date = new Date(dateString);
    return Math.floor(date.getTime() / 1000);
  };

  /**
   * crawl
   * @param {string} query
   * @returns {Promise<string[]>}
   * @description Crawls the queue of known links
   */
  crawl = async url => {
    return axios
      .get(url)
      .then(response => {
        const html = response.data;
        // Use Cheerio to parse the HTML content
        const $ = cheerio.load(html);
        const carData = {}; // Object to store the car data
        const matchingElements = $('table.rUzP-table tr');
        matchingElements.each((index, element) => {
          const carType = $(element).find('.rUzP-name').text().trim();
          const carPrice = $(element).find('.rUzP-price').text().trim();
          if (this.desiredCarTypes.includes(carType)) {
            carData[carType] = parseFloat(carPrice.replace('$', ''));
          }
        });
        console.log(carData);
        return carData;
      })
      .catch(error => console.log(error));
  };

  storeScrapeOnIPFS = async data => {
    console.log('storing scrape on IPFS');
    const round = await namespaceWrapper.getRound();
    const files = await makeFileFromObjectWithName(data);
    console.log('files', files);
    const cid = await storeFiles(files);
    console.log('cid', cid);
    await this.cids.create({
      id: 'scrapeCid:' + round + ':' + data.timestamp,
      round: round,
      cid: cid,
    });
    return cid;
  };

  /**
   * stop
   * @returns {Promise<boolean>}
   * @description Stops the crawler
   */
  stop = async () => {
    return (this.break = true);
  };
}

module.exports = Kayak;

// TODO - move the following functions to a utils file?
function makeStorageClient() {
  return new Web3Storage({ token: getAccessToken() });
}

async function makeFileFromObjectWithName(obj) {
  const databuffer = Buffer.from(JSON.stringify(obj));
  const dataJson = new File([databuffer], 'data.json', {
    type: 'application/json',
  });

  //   const htmlBuffer = Buffer.from(item);
  //   const dataHtml = new File([htmlBuffer], 'data.txt', {
  //     type: 'text/html;charset=UTF-8',
  //   });

  return { dataJson };
}

async function storeFiles(files) {
  const client = makeStorageClient();
  const cid = await client.put([files.dataJson]);
  // console.log('stored files with cid:', cid);
  return cid;
}

function getAccessToken() {
  // If you're just testing, you can paste in a token
  // and uncomment the following line:
  // return 'paste-your-token-here'

  // In a real app, it's better to read an access token from an
  // environement variable or other configuration that's kept outside of
  // your code base. For this to work, you need to set the
  // WEB3STORAGE_TOKEN environment variable before you run your code.
  return process.env.SECRET_WEB3_STORAGE_KEY;
}
