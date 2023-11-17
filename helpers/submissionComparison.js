async function deepEqual(obj1, obj2, thresholdPercentage) {
  // const keys1 = Object.keys(obj1);
  // // Get the keys of the second object
  // const keys2 = Object.keys(obj2);

  // // Check if the number of keys in both objects is the same
  // if (keys1.length !== keys2.length) {
  //   return false;
  // }

  // // Iterate through the keys and compare their values
  // for (const key of keys1) {
  //   // If the key exists in both objects
  //   if (obj2.hasOwnProperty(key)) {
  //     // If the values are objects, recursively check them
  //     if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
  //       if (!deepEqual(obj1[key], obj2[key])) {
  //         return false;
  //       }
  //     } else {
  //       // Compare the values
  //       if (obj1[key] !== obj2[key]) {
  //         return false;
  //       }
  //     }
  //   } else {
  //     return false;
  //   }
  // }

  // return true;

  // ********** THRESHOLD LOGIC ********** ////////

  for (const city in obj1) {
    if (obj2.hasOwnProperty(city)) {
      for (const carType in obj1[city]) {
        if (obj2[city].hasOwnProperty(carType)) {
          const value1 = obj1[city][carType];
          //console.log('value1', value1);
          const value2 = obj2[city][carType];
          //console.log('value2', value2);
          const differencePercentage =
            Math.abs((value1 - value2) / value1) * 100;

          if (differencePercentage > thresholdPercentage) {
            return false;
          }
        } else {
          // Handle the case where carType is missing in obj2
          return false;
        }
      }
    } else {
      // Handle the case where city is missing in obj2
      return false;
    }
  }

  return true;
}

module.exports = deepEqual;
