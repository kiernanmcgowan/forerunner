// forerunner-worker
// managers the communication between job processing and the forerunner

var socket = null;
var initialManifestSent = false;

var _jobHandlers = {};

var _idTypeMap = {};

var io = require('socket.io-client');
var async = require('async');
var _ = require('underscore');

var _known_manager_token;

function start(forerunnerLocation) {
  console.log('ForerunnerWorker - connecting to ' + forerunnerLocation);
  socket = io.connect(forerunnerLocation);
  socket.on('connect', function() {
    console.log('ForerunnerWorker - connected to forerunner manager');
    sendManifest();
    initialManifestSent = true;
  });

  socket.on('new_job', function(data, cb) {
    console.log('ForerunnerWorker - new job id: ' + data.id);
    // check to make sure the manager is in a proper state
    if (!_known_manager_token || _known_manager_token != data._manager_uuid) {
      console.error('ForerunnerWorker - manager token mismatch');
      // callback now b/c the process might be going down right now
      cb({err: 'Tokens do not match. got: ' + data._manager_uuid +
                    ' expected: ' + _known_manager_token,
          token_mismatch: true});
      return handleBadManagerToken();
    }
    _idTypeMap[data.id] = data.type;
    // notify the manager that the job is on the worker
    cb();
    // in case the handler throws an error
    try {
      runHandler(data.id, data.type, data.payload, function(err, results) {
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
  if (jobType === 'progress') {
    throw new Error('\'progress\' is a reserved token and cannot be used as a job type');
  }
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

function runHandler(jobId, jobType, jobData, cb) {
  _jobHandlers[jobType](jobId, jobData, cb);
}
module.exports.runHandler = runHandler;

// allows for many tasks to be composed into one job type
function compose(tasks) {
  // make sure everything is ok
  for (var i = 0; i < tasks.length; i++) {
    if (typeof tasks[i] !== 'string' && typeof tasks[i] !== 'function') {
      throw new Error('Invalid composition type (string or function only): ' + typeof tasks[i]);
    }
    // check for the formatting of progress events
    if (typeof tasks[i] === 'string' && tasks[i].indexOf('progress') === 0) {
      // make sure there are only 2 array components after the split
      var parts = tasks[i].split(':').length;
      if (parts > 2) {
        throw new Error('Invalid progress message formatting (hint - no : allowed in the message)');
      } else if (parts < 2) {
        throw new Error('Invalid progress message formatting (no message found)');
      }
    }
  }

  return function(id, data, callback) {
    var currentFunctionIndex = 0;
    var cb = function(err, retData) {
      currentFunctionIndex++;
      // there is an error, return right away
      if (err) {
        callback(err);
      } else if (currentFunctionIndex < tasks.length) {
        // preserve original commands, unless overwritten by a task
        // only do this when compositing since functions are suppose to chain!
        // TODO: this should error in v0.2
        if (typeof retData === 'string') {
          console.warn('Step in composed job returned a string - this will break in the next version of forerunner');
          console.warn('job id: ' + id);
          retData = {result: retData};
        }
        retData = _.extend(data, retData);
        if (typeof tasks[currentFunctionIndex] === 'string') {
          // check to see if it is a handler referance or a progress message
          if (tasks[currentFunctionIndex].indexOf('progress') === 0) {
            // pull out the message and send it to the manager
            var progress = tasks[currentFunctionIndex].split(':')[1];
            jobProgress(id, progress);
            // then pass data down the chain
            cb(null, retData);
          } else {
            _jobHandlers[tasks[currentFunctionIndex]](id, retData, cb);
          }

        } else {
          tasks[currentFunctionIndex](id, retData, cb);
        }
      } else {
        callback(null, retData);
      }
    };

    if (typeof tasks[currentFunctionIndex] === 'string') {
      // in case the first thing is a progress event
      if (tasks[currentFunctionIndex].indexOf('progress') === 0) {
        var progress = tasks[currentFunctionIndex].split(':')[1];
        jobProgress(id, progress);
        // no return data
        cb(null);
      } else {
        _jobHandlers[tasks[currentFunctionIndex]](id, data, cb);
      }
    } else {
      tasks[currentFunctionIndex](id, data, cb);
    }

  };
}
module.exports.compose = compose;

function sendManifest() {
  console.log('ForerunnerWorker - Sending manifest');
  if (socket) {
    socket.emit('manifest', {manifest: Object.keys(_jobHandlers)}, function(currentManagerToken) {
      console.log('ForerunnerWorker - acknowledge recived');
      if (!_known_manager_token) {
        console.log('ForerunnerWorker - setting manager token for the first time: ' + currentManagerToken);
        _known_manager_token = currentManagerToken;
      } else if (_known_manager_token == currentManagerToken) {
        console.warn('ForerunnerWorker - tokens match, but manifest was sent. Serivce interruption?');
      } else if (_known_manager_token != currentManagerToken) {
        console.error('ForerunnerWorker - tokens DO NOT match, manager process has restarted');
        handleBadManagerToken();
      }
    });
  } else {
    console.error('ForerunnerWorker - socket not connected, cant send manifest');
  }
}

function jobProgress(id, progress) {
  console.log('ForerunnerWorker - Job Progress id: ' + id + ' progress ' + progress);
  if (socket) {
    socket.emit('job_progress', {id: id, type: _idTypeMap[id], progress: progress});
  } else {
    console.warn('ForerunnerWorker - socket not connected');
  }

}

function jobFinished(id, output) {
  console.log('ForerunnerWorker - Job Complete id: ' + id);
  if (socket) {
    socket.emit('job_complete', {id: id, type: _idTypeMap[id], result: output});
  } else {
    console.warn('ForerunnerWorker - socket not connected');
  }
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

// what do we do when a bad token comes a long?
function handleBadManagerToken() {
  console.error('ForerunnerWorker - token mismatch discovered');
  // right now we just kill off the worker
  console.error('ForerunnerWorker - killing process');
  process.exit();
}
