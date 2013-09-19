// url-rate-limit
// lets you rate limit urls (ie for robots.txt)

var url = require('url');

function constructor(jobType, limitedKey) {
  this.jobType = jobType;
  this.limitedKey = limitedKey;
  this.limitedUrls = {};
}
module.exports = constructor;

constructor.prototype.limit = function(url, timeout) {
  var parsedUrl = url.parse(url);
  // if we are not keeping track of anything yet
  if (!limitedUrls[parsedUrl.hostname]) {
    limitedUrls[parsedUrl.hostname] = true;
    setTimeout(function() {
      delete limitedUrls[parsedUrl.hostname];
    }, timeout * 1000);
  }
};

constructor.prototype.preHooks = function(argument) {
  var self = this;
  var hooks = {};
  hooks[this.jobType] = function(jobId, jobData) {
    return !(self.limitedUrls[jobData[self.limitedKey]]);
  };
  return hooks;
};
