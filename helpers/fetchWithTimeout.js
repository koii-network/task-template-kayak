const fetch = require('node-fetch');

module.exports = async (url, timeout = 30000) => {
  const { signal, abort } = new AbortController();
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      abort();
      reject(new Error('Request timed out'));
    }, timeout);

    fetch(url, { signal })
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        if (error.name === 'AbortError') {
          reject(new Error('Request was aborted'));
        } else {
          reject(error);
        }
      });
  });
};
