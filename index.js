module.exports.titan = require('./lib/titan');

module.exports.worker = require('./lib/worker');

module.exports.builtin = {
  get_hrefs: require('./lib/builtins/get_hrefs')
};