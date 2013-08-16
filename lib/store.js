// harbinger-store.js
// manages the data store in harbinger

// uuid for job names
var async = require('async');
var _queue = null;
var _store = null;

// loads both the job store and job writer
function construct(queueMod, storeMod, callback) {
  _queue = load(queueMod);
  _store = load(storeMod);

  // init both the save and the store
  // if they are the save, just load one
  if (_store !== _queue) {
    _queue.init(callback);
  } else {
    async.series([
      function(cb) {
        _queue.init(callback);
      },
      function(cb) {
        _store.init(callback);
      }
    ],
    callback);
  }
}

construct.createJob = function(jobName, jobData, callback) {
  _queue.createJob(jobName, jobData, callback);
};

construct.queuedJobs = function(callback) {
  _queue.queuedJobs(callback);
};

construct.fetchJob = function(jobId, callback) {
  _queue.fetchJob(jobId, callback);
};

construct.countFailedJob = function(jobId, message, callback) {
  _queue.countFailedJob(jobId, message, callback);
};

construct.storeJob = function(jobId, jobResult, callback) {
  _store.storeJob(jobId, jobResult, callback);
};

module.exports = construct;

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
    throw new Error('Only require strings or objects allowed for data queues and stores');
  }
  return obj;
}