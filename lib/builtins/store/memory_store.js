// console_save
// echos job results to the console
var uuid = require('node-uuid');

var jobs = {};

var completedJobs = {};
var failedJobs = {};

module.exports.create = function(jobType, jobData, callback) {
  // since this store is just for testing, print to console log
  var id = uuid();
  jobs[id] = {
    id: id,
    type: jobType,
    fail_count: 0,
    input: jobData,
    progress: null
  };
  process.nextTick(function() {
    callback(null, id, jobData);
  });
};

module.exports.getQueue = function(callback) {
  process.nextTick(function() {
    callback(null, jobs);
  });
};

module.exports.progress = function(jobId, progress, callback) {
  if (!jobs[jobId]) {
    process.nextTick(function() {
      callback(new Error('Job with id not found! id:' + jobId));
    });
    return;
  }
  jobs[jobId].progress = progress;
  process.nextTick(function() {
    callback(null);
  });
};

module.exports.countFailed = function(jobId, message, callback) {
  if (!jobs[jobId]) {
    process.nextTick(function() {
      callback(new Error('Job with id not found! id:' + jobId));
    });
    return;
  }
  jobs[jobId].fail_count = jobs[jobId].fail_count + 1;
  process.nextTick(function() {
    callback(null, jobs[jobId].fail_count);
  });
};

module.exports.failed = function(jobId, callback) {
  if (!jobs[jobId]) {
    process.nextTick(function() {
      callback(new Error('Job with id not found! id:' + jobId));
    });
    return;
  }
  failedJobs[jobId] = jobs[jobId];
  delete jobs[jobId];
  process.nextTick(function() {
    callback(null);
  });
};

module.exports.complete = function(jobId, jobResult, callback) {
  if (!jobs[jobId]) {
    process.nextTick(function() {
      callback(new Error('Job with id not found! id:' + jobId));
    });
    return;
  }
  completedJobs[jobId] = jobs[jobId];
  completedJobs[jobId].results = jobResult;
  delete jobs[jobId];
  process.nextTick(function() {
    callback(null);
  });
};

// end forerunner function

// utility function to get job status
// mostly used writing out after standalone mode
module.exports.getJobs = function() {
  return {
    failed: failedJobs,
    complete: completedJobs,
    currentJobs: jobs
  };
};