module.exports.forerunner = require('./lib/forerunner');

module.exports.worker = require('./lib/worker');

module.exports.builtin = {
  get_hrefs: require('./lib/builtins/get_hrefs'),
  fetch: require('./lib/builtins/fetch'),
  targz: require('./lib/builtins/targz'),
  key_map: require('./lib/builtins/key_map'),
  pluck_data: require('./lib/builtins/pluck_data'),
  word_count: require('./lib/builtins/word_count')
};