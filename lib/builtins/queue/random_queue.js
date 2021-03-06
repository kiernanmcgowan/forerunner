// memory_store
// process memory store for forerunner
var _ = require('underscore');

var jobs = [];
var jobFailCount = {};

module.exports.push = function(jobId, jobType, jobData, callback) {
  var data = {
    jobId: jobId,
    jobType: jobType,
    jobData: jobData
  };
  jobs.push(data);
  process.nextTick(function() {
    callback();
  });
};

module.exports.each = function(count, eachFn, callback) {
  jobs = _.shuffle(jobs);
  for (var i = 0; i < count && jobs.length > 0; i++) {
    var job = jobs.shift();
    eachFn(job.jobId, job.jobType, job.jobData);
  }
  process.nextTick(function() {
    callback();
  });
};

module.exports.requeue = function(jobId, jobType, jobData, callback) {
  var data = {
    jobId: jobId,
    jobType: jobType,
    jobData: jobData
  };
  process.nextTick(function() {
    jobs.unshift(data);
    callback();
  });
};

module.exports.empty = function(callback) {
  jobs = [];
  process.nextTick(function() {
    callback();
  });
};
