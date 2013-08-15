// harbinger-store.js
// manages the data store in harbinger

// uuid for job names
var async = require('async');
var _store = null;
var _save = null;

// loads both the job store and job writer
function register_store(storeMod, saveMod, callback) {
  _store = load(storeMod);
  _save = load(saveMod);

  // init both the save and the store
  // if they are the save, just load one
  if (_save !== _store) {
    _store.init(callback);
  } else {
    async.series([
      function(cb) {
        _store.init(callback);
      },
      function(cb) {
        _save.init(callback);
      }
    ],
    callback);
  }
}

register_store.createJob = function(jobName, jobData, callback) {
  _store.createJob(jobName, jobData, callback);
};

register_store.queuedJobs = function(callback) {
  _store.queuedJobs(callback);
};

register_store.fetchJob = function(jobId, callback) {
  _store.fetchJob(jobId, callback);
};

register_store.countFailedJob = function(jobId, message, callback) {
  _store.countFailedJob(jobId, message, callback);
};

register_store.storeJob = function(jobId, jobResult, callback) {
  _save.storeJob(jobId, jobResult, callback);
};

module.exports = register_store;

function load(mod) {
  var obj = null;
  if (typeof mod === 'string') {
    try {
      obj = require(mod);
    } catch (err) {
      console.error('failed to load module: ' + mod);
      throw err;
    }
  } else if (typeof mod === 'object') {
    // check to make sure that the store object has the correct functions
    obj = object;
  } else {
    throw new Error('Only require strings or objects allowed for data stores');
  }
  return obj;
}