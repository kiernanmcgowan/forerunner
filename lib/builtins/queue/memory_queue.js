// memory_store
// process memory store for forerunner

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
  jobs.unshift(data);
  process.nextTick(function() {
    callback();
  });
};