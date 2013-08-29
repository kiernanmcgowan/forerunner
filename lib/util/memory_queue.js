// memory_store
// process memory store for harbinger

var uuid = require('node-uuid');
var jobs = {};
var jobFailCount = {};

module.exports.init = function(callback) {
  callback();
};

module.exports.createJob = function(jobName, jobData, callback) {
  var id = uuid();
  jobs[id] = {
    name: jobName,
    data: jobData
  };
  // return the id
  callback(null, id);
};

module.exports.queuedJobs = function(callback) {
  // return the ids of all of the job in the queue
  // (will always be [] in this case, but used for example)
  callback(null, Object.keys(jobs));
};

module.exports.fetchJob = function(jobId, callback) {
  callback(null, jobs[jobId].name, jobs[jobId].data);
};

module.exports.removeJob = function(jobId, callback) {
  delete jobs[jobId];
  callback();
};

module.exports.countFailedJob = function(jobId, message, callback) {
  if (!jobFailCount[jobId]) {
    jobFailCount[jobId] = 0;
  }
  jobFailCount[jobId]++;
  console.log('Job ' + jobId + ' failed because ' + message);
  callback(null, jobFailCount[jobId]);
};