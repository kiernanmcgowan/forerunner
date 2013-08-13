// titan-worker
// managers the communication between job processing and the titan

var socket = null;
var _workerManifest = null;
var _newJobHandler = null;

var io = require('socket.io-client');

function start(titanLocation, manifest, newJobHandler) {
  socket = io.connect(titanLocation);
  socket.on('connect', function () {
    socket.emit('manifest', {manifest: manifest});
  });

  _newJobHandler = newJobHandler;

  socket.on('new_job', function(data) {
    newJob(data.id, data.payload);
  });
}
module.exports.start = start;

function newJob(job, data) {
  _newJobHandler(job, data);
}

function jobFinished(id, output) {
  socket.emit('job_complete', {id:id, result: output});
}
module.exports.finished = jobFinished;

function jobFailed(message) {
  socket.emit('job_failed', {result: message});
}
module.exports.failed = jobFailed;