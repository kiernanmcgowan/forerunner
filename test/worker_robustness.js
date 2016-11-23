// worker_robustness
// tests to test the robustness of a worker in another process
var vows = require('vows');
var async = require('async');
var _ = require('underscore');
var assert = require('assert');
var uuid = require('uuid');
var path = require('path');
var eventsModule = require('events');
var events = new eventsModule.EventEmitter();

// hooray multiprocess testing!
var cluster = require('cluster');
var io = require('socket.io');

var uuidToSend;
var workerSocket;
var waitOnSocket = true;

// setup the worker
cluster.setupMaster({
  exec: path.join(__dirname, './subprocess/worker.js'),
  // hush the logs
  silent: true
});

cluster.on('exit', function(worker) {
  waitOnSocket = true;
  // hmm, it looks like node 0.8 does not have this method
  //worker.kill();
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
    events.emit('worker_connection');
  });
});

function testModule(testCallbacks) {
  // in order to force syncrounous steps, each test is its own batch
  // not the best use for vows, but works well enough
  var tests = vows.describe('Worker - robustness')
  .addBatch({
    'Not sending a manager token': {
      topic: function() {
        // create a worker
        cluster.fork();

        var self = this;
        events.once('worker_connection', function() {
          sendPingJob(uuid(), self.callback);
        });
      },

      'fails when a job comes along': function(err, response) {
        assert.isObject(err);
        assert.isTrue(err.token_mismatch);
      }
    }
  })
  .addBatch({
    'Sending a manager token': {
      topic: function() {
        // set a uuid to send along
        uuidToSend = uuid();
        // create a worker
        cluster.fork();

        var self = this;
        events.once('worker_connection', function() {
          sendPingJob(uuidToSend, self.callback);
        });
      },

      'works with the correct token': function(err) {
        assert.isUndefined(err);
      },

      'but with a wrong token': {
        topic: function() {
          sendPingJob(uuid(), this.callback);
        },

        'the worker errors': function(err, response) {
          assert.isObject(err);
          assert.isTrue(err.token_mismatch);
        }
      }
    }
  })
  .run({reporter: require('vows/lib/vows/reporters/spec')}, testCallbacks);
}
module.exports = testModule;

function sendPingJob(testToken, callback) {
  workerSocket.emit('new_job', {
    id: uuid(),
    type: 'ping',
    payload: {},
    _manager_uuid: testToken
  }, function(err) {
    callback(err);
  });
}
