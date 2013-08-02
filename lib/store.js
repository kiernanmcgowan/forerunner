// titan-store.js
// manages the data store in titan

var _stores = {};

// registers a store name to a fn
function register_store(name, mod) {
  var store = null;
  if (typeof mod === 'string') {
    try {
      store = require(mod);
    } catch (err) {
      console.error('failed to load module: ' + mod);
      throw err;
    }
  } else if (typeof mod === 'object') {
    // check to make sure that the store object has the correct functions
    store = object;
  } else {
    throw new Error('Only require strings or objects allowed for data stores');
  }
}
module.exports.register = register_store;

// job is done, save it
function storeJob(storeName, jobData, callback) {

}
module.exports.storeJob = storeJob;

// job hahs failed, record and move on
function countFailedJob(storeName, jobId, callback) {

}
module.exports.countFailedJob = countFailedJob;

// job has updated, lets go!
function updateJob(storeName, jobData) {

}
module.exports.updateJob = updateJob
