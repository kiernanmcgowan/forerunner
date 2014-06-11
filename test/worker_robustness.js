// worker_robustness
// tests to test the robustness of a worker in another process
var vows = require('vows');
var async = require('async');
var _ = require('underscore');
var assert = require('assert');

// hooray multiprocess testing!
var cluster = require('cluster');

var uuidToSend;
var workerSocket;
var waitOnSocket = true;

// setup the worker
cluster.setupMaster({
  exec: './subprocess/worker.js',
  // hush the logs
  silent: true
});
reanimate();

cluster.on('disconnect', function(worker) {
  waitOnSocket = true;
  worker.kill();
  reanimate();
});

var socketObj = io.listen(2718, {
  log: false
});

socketObj.on('connection', function(testSocket) {
  waitOnSocket = true;
  workerSocket = testSocket;
  // kick off the tests on the first connection
  workerSocket.on('manifest', function(data, ack) {
    // tests will brute force their way through this
    ack(uuidToSend);

    waitOnSocket = false;

    runTests();
  });
});

function testModule(testCallbacks) {
  // in order to force syncrounous steps, each test is its own batch
  // not the best use for vows, but works well enough
  var tests = vows.describe('Worker')
  .addBatch({
    'Manager tokens': {
      topic: function() {
        cluster.setupMaster({
          exec: './subprocess/worker.js'
        });
        cluster.fork();
      }
    }
  })
  .run({reporter: require('vows/lib/vows/reporters/spec')}, testCallbacks);
}
module.exports = testModule;

// bring a worker back from the dead
function reanimate() {
  if (Object.keys(cluster.workers).length > 0) {
    throw new Error('There are active workers');
  }
  cluster.fork();
}
