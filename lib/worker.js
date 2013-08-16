// harbinger-worker
// managers the communication between job processing and the harbinger

var socket = null;
var initialManifestSent = false;

var _jobHandlers = {};

var _idTypeMap = {};

var io = require('socket.io-client');
var async = require('async');
var _ = require('underscore');

function start(harbingerLocation) {
  socket = io.connect(harbingerLocation);
  socket.on('connect', function () {
    sendManifest();
    initialManifestSent = true;
  });

  socket.on('new_job', function(data, cb) {
    _idTypeMap[data.id] = data.type;
    // in case the handler throws an error
    try {
      _jobHandlers[data.type](data.id, data.type, data.payload, function(err, results) {
        if (err) {
          jobFailed(data.id, err);
        } else {
          jobFinished(data.id, results);
        }
      });
    } catch (err) {
      console.log(err);
      console.log(err.stack);
      jobFailed(data.id, err);
    }
  });
}
module.exports.start = start;

function registerJobHandler(jobType, jobHandler) {
  if (typeof jobHandler === 'function') {
    _jobHandlers[jobType] = jobHandler;
  } else {
    throw new Error('Job handlers can only be functions. broken type: ' + jobType);
  }

  // if a new job handler has been registered, but the manifest sent,
  if (initialManifestSent) {
    sendManifest();
  }
}
module.exports.registerJobHandler = registerJobHandler;

// allows for many tasks to be composed into one job type
function compose(tasks) {
  // make sure everything is ok
  for (var i = 0; i < tasks.length; i++) {
    if (typeof tasks[i] !== 'string' && typeof tasks[i] !== 'function') {
      throw new Error('Invalid composition type (string or function only): ' + typeof tasks[i]);
    }
  }

  return function(id, type, data, callback) {
    var currentFunctionIndex = 0;
    var cb = function(err, retData) {
      currentFunctionIndex++;
      // there is an error, return right away
      if (err) {
        callback(err);
      } else if (currentFunctionIndex < tasks.length) {
        // preserve original commands, unless overwritten by a task
        // only do this when compositing since functions are suppose to chain!
        retData = _.extend(data, retData);
        if (typeof tasks[currentFunctionIndex] === 'string') {
          _jobHandlers[tasks[currentFunctionIndex]](id, type, retData, cb);
        } else {
          tasks[currentFunctionIndex](id, type, retData, cb);
        }
      } else {
        callback(null, retData);
      }
    };

    if (typeof tasks[currentFunctionIndex] === 'string') {
      _jobHandlers[tasks[currentFunctionIndex]](id, type, data, cb);
    } else {
      tasks[currentFunctionIndex](id, type, data, cb);
    }

  };
}
module.exports.compose = compose;

function sendManifest() {
  socket.emit('manifest', {manifest: Object.keys(_jobHandlers)});
}

function jobFinished(id, output) {
  socket.emit('job_complete', {id: id, type: _idTypeMap[id], result: output});
}

function jobFailed(id, err) {
  var message = null;
  if (err instanceof Error) {
    message = err.message + '\n' + err.stack;
  } else if (typeof err === 'object') {
    message = JSON.stringify(err);
  } else {
    message = err;
  }
  socket.emit('job_failed', {id: id, type: _idTypeMap[id], message: message});
}