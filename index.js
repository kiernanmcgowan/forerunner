module.exports.forerunner = require('./lib/forerunner');

module.exports.worker = require('./lib/worker');

module.exports.proxy = require('./lib/proxy');

module.exports.builtin = {
  tasks: {
    get_hrefs: require('./lib/builtins/tasks/get_hrefs'),
    fetch: require('./lib/builtins/tasks/fetch'),
    targz: require('./lib/builtins/tasks/targz'),
    key_map: require('./lib/builtins/tasks/key_map'),
    pluck_data: require('./lib/builtins/tasks/pluck_data'),
    word_count: require('./lib/builtins/tasks/word_count'),
    ping: require('./lib/builtins/tasks/ping')
  }
};