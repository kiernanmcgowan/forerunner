// titan-worker
// managers the communication between job processing and the titan

var socket = null;
var initialManifestSent = false;

var _jobHandlers = {};

var _idTypeMap = {};

var io = require('socket.io-client');

function start(titanLocation) {
  socket = io.connect(titanLocation);
  socket.on('connect', function () {
    sendManifest();
    initialManifestSent = true;
  });

  socket.on('new_job', function(data, cb) {
    _idTypeMap[data.id] = data.type;
    _jobHandlers[data.type](data.id, data.type, data.payload, function(err, results) {
      if (err) {
        jobFailed(data.id, err);
      } else {
        jobFinished(data.id, results);
      }
    });
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

function sendManifest() {
  socket.emit('manifest', {manifest: Object.keys(_jobHandlers)});
}

function jobFinished(id, output) {
  socket.emit('job_complete', {id: id, type: _idTypeMap[id], result: output});
}

function jobFailed(id, err) {
  var message = null;
  if (err instanceof Error) {
    message = err.message;
  } else {
    message = JSON.stringify(err);
  }
  socket.emit('job_failed', {id: id, type: _idTypeMap[id], message: message});
}