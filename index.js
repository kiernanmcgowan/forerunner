module.exports.titan = require('./lib/titan');

module.exports.worker = {
  base: require('./lib/worker'),
  link_scrape: require('./lib/builtins/link_scrape')
};