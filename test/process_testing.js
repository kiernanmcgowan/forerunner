// process testing
var cluster = require('cluster');
var _ = require('underscore');
var io = require('socket.io');
var uuid = require('node-uuid');
var async = require('async');

// setup the worker
cluster.setupMaster({
  exec: './subprocess/worker.js',
  // hush the logs
  silent: true
});
reanimate();

cluster.on('disconnect', function(worker) {
  console.log('worker disconnected: ' + worker.id);
  worker.kill();
  reanimate();
});

var uuidToSend;
var workerSocket;

var socketObj = io.listen(2718, {
  log: false
});
socketObj.on('connection', function(testSocket) {
  workerSocket = testSocket;
  // kick off the tests on the first connection
  workerSocket.on('manifest', function(data, ack) {
    // tests will brute force their way through this
    ack(uuidToSend);

    runTests();

    // test to make sure the manifest is properly formatted

    // try to asign a job now (expect the worker to fail)


    // send along a uuid


    // send along a job

    // send along a job with a different uuid (should break)
  });
});

var runTests = function() {
  var fn = tests.shift();
  if (!fn) {
    console.log('tests complete');
    process.exit();
  }
  fn(function(err) {
    console.log(err);
    process.nextTick(function() {
      runTests();
    });
  });
};

var tests = [
  function(cb) {
    console.log('\nTest to make worker fail with no token');
    // first send no uuid, then send a job with a uuid
    workerSocket.emit('new_job', {
      _manager_uuid: uuid()
    }, function(err) {
      // set the uuid for here on out
      uuidToSend = uuid();
      if (err) {
        // bring up another worker
        cb(null, true);
      } else {
        cb({err: 'Worker was suppose to disconnect'});
      }
    });
  },
  function(cb) {
    console.log('\nTest to make sure worker works with a token');
    // now send off a good uuid
    console.log('sending off job');
    workerSocket.emit('new_job', {
      id: uuid(),
      type: 'ping',
      payload: {},
      _manager_uuid: uuidToSend
    }, function(err) {
      console.log('job got back');
      if (err) {
        // bring up another worker
        cb(err);
      } else {
        cb();
      }
    });
  },
  function(cb) {
    console.log('\nSend off the wrong token');
    // now send off a good uuid
    workerSocket.emit('new_job', {
      id: uuid(),
      type: 'ping',
      payload: {},
      _manager_uuid: uuid()
    }, function(err) {
      if (err) {
        // bring up another worker
        cb(null, true);
      } else {
        cb({err: 'Worker was suppose to disconnect'});
      }
    });
  }
];

// bring a worker back from the dead
function reanimate() {
  if (Object.keys(cluster.workers).length > 0) {
    throw new Error('There are active workers');
  }
  cluster.fork();
}

function killall() {
  for (var id in cluster.workers) {
    cluster.workers[id].kill();
  }
}
