async function deepEqual(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  // Get the keys of the second object
  const keys2 = Object.keys(obj2);

  // Check if the number of keys in both objects is the same
  if (keys1.length !== keys2.length) {
    return false;
  }

  // Iterate through the keys and compare their values
  for (const key of keys1) {
    // If the key exists in both objects
    if (obj2.hasOwnProperty(key)) {
      // If the values are objects, recursively check them
      if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
        if (!deepEqual(obj1[key], obj2[key])) {
          return false;
        }
      } else {
        // Compare the values
        if (obj1[key] !== obj2[key]) {
          return false;
        }
      }
    } else {
      return false;
    }
  }

  return true;
}

module.exports = deepEqual;
