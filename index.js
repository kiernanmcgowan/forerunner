module.exports.harbinger = require('./lib/harbinger');

module.exports.worker = require('./lib/worker');

module.exports.builtin = {
  get_hrefs: require('./lib/builtins/get_hrefs'),
  fetch: require('./lib/builtins/fetch'),
  targz: require('./lib/builtins/targz')
};