// forerunner test
// wrapper around all the awesome tests that forerunner has

var async = require('async');

// test suites for the built in stuff
var storeTestSuite = require('forerunner-store-tests');
var queueTestSuite = require('forerunner-queue-tests');

// tests for the rest of forerunner
var workerTestSuite = require('./worker');
var workerRobustnessSuite = require('./worker_robustness');

// builtins
var store = require('../index').builtin.store.memory;
var queue = require('../index').builtin.queue.memory;

async.series([
  function(cb) {
    storeTestSuite(store, function(results) {
      cb(results.broken);
    });
  },
  function(cb) {
    queueTestSuite(queue, function(results) {
      cb(results.broken);
    });
  },
  function(cb) {
    workerTestSuite(function(results) {
      cb(results.broken);
    });
  },
  function(cb) {
    workerRobustnessSuite(function(results) {
      cb(results.broken);
    });
  }
],
function(err) {
  process.exit(err);
});
