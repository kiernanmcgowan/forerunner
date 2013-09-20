// console_save
// echos job results to the console
var uuid = require('uuid');

var jobs = {};

var completedJobs = {};

module.exports.create = function(jobType, jobData, callback) {
  // since this store is just for testing, print to console log
  var id = uuid();
  jobs[id] = {
    type: jobType,
    fail_count: 0,
    input: jobData,
    progress: null
  }
  process.nextTick(function() {
    callback(null, id);
  });
};

module.exports.progress = function(jobId, progress, callback) {
  jobs[jobId].progress = progress;
  process.nextTick(function() {
    callback(null);
  });
};

module.exports.countFailed = function(jobId, callback) {
  jobs[jobId].fail_count = jobs[jobId].fail_count + 1;
  process.nextTick(function() {
    callback(null, jobs[jobId].fail_count);
  });
};

module.exports.complete = function(jobId, jobResult, callback) {
  completedJobs[jobId] = jobs[jobId];
  completedJobs[jobId].results = jobResult;
  delete jobs[jobId];
  process.nextTick(function() {
    callback(null);
  });
};