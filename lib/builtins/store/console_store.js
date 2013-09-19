// console_save
// echos job results to the console

module.exports.init = function(callback) {
  callback();
};

module.exports.storeJob = function(jobId, jobResult, callback) {
  // since this store is just for testing, print to console log
  //console.log('job finished: ' + jobId);
  //console.log(JSON.stringify(jobResult, null, 2));
  callback();
};