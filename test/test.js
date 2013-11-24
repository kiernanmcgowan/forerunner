// forerunner test
// wrapper around all the awesome tests that forerunner has

var async = require('async');
var storeTestSuite = require('forerunner-store-tests');
var queueTestSuite = require('forerunner-queue-tests');

// builtins
var store = require('../index').builtin.store.memory;
var queue = require('../index').builtin.queue.memory;

async.series([
  function (cb) {
    storeTestSuite(store, function(results) {
      cb(results.broken);
    });
  },
  function (cb) {
    queueTestSuite(queue, function(results) {
      cb(results.broken);
    });
  }
],
function(err) {
  process.exit(err);
});
