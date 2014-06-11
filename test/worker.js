// workerTestSuite
// tests for a forerunner worker
var vows = require('vows');
var async = require('async');
var _ = require('underscore');
var assert = require('assert');

// hooray multiprocess testing!
var cluster = require('cluster');

var sampleData = [];

var worker = require('../index').worker;

function testModule(testCallbacks) {
  var tests = vows.describe('Worker')
  .addBatch({
    'Registering various jobs': {
      topic: function() {
        worker.registerJobHandler('task1', function(id, data, _cb) {
          _cb(null, {out: 'foo'});
        });
        worker.runHandler('id', 'task1', {}, this.callback);
      },
      'Does not error': function(err, topic) {
        assert.isNull(err);
        assert.isObject(topic);
        assert.equal('foo', topic.out);
      },

      'composing jobs with progress events': {
        topic: function() {
          var composedJob = worker.compose([
            'progress:start',
            'task1',
            'progress:middle',
            function(id, data, _cb) {
              _cb(null, {out: 'bar'});
            },
            'progress:end'
          ]);
          worker.registerJobHandler('task2', composedJob);
          worker.runHandler('id2', 'task2', {}, this.callback);
        },
        'Does not error': function(err, topic) {
          assert.isNull(err);
          assert.isObject(topic);
          assert.equal('bar', topic.out);
        }
      }
    }
  })
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
