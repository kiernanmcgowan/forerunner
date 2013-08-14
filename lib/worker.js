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
    _jobHandlers[data.type](data.id, data.type, data.payload);
  });
}
module.exports.start = start;

function registerJobHandler(jobType, jobHandler) {
  _jobHandlers[jobType] = jobHandler;

  // if a new job handler has been registered, but the manifest sent,
  if (initialManifestSent) {
    sendManifest();
  }
}
module.exports.registerJobHandler = registerJobHandler;

function newJob(job, data) {
  _newJobHandler(job, data);
}

function sendManifest() {
  socket.emit('manifest', {manifest: Object.keys(_jobHandlers)});
}
module.exports.sendManifest = sendManifest;

function jobFinished(id, output) {
  socket.emit('job_complete', {id: id, type: _idTypeMap[id], result: output});
}
module.exports.finished = jobFinished;

function jobFailed(id, message) {
  socket.emit('job_failed', {id: id, type: _idTypeMap[id], result: message});
}
module.exports.failed = jobFailed;