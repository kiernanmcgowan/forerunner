// proxy
// manages the events between the manager and the workers
// only use this code if you are a level 12 hacker

// proxy to run on
var proxyPort = process.env.FR_PROXY_PORT || 2718;
// if the proxy should crash on
var volitle = process.env.FR_PROXY_VOLITILE || false;

function badThings(msg) {
  if (volitle) {
    throw new Error(msg);
  } else {
    console.error(msg);
  }
}

module.exports.start = function() {
  console.log('starting the forerunner proxy');

  var io = require('socket.io');
  io = require('socket.io');
  var proxySocket = io.listen(proxyPort);

  var managerSocket = null;
  var workerSockets = {};

  proxySocket.on('connection', function(socket) {

    console.log('new socket connected');

    socket.on('manager_register', function(data) {
      // for now be lazy, and just accept the manager
      // auth can be built in later
      if (workerSockets[socket.id]) {
        console.log('removing the manager socket from the worker pool');
        delete workerSockets[socket.id];
      }
      if (!managerSocket) {
        managerSocket = socket;
        // find the worker socket that it wants to route to
        managerSocket.on('new_job', function(data) {
          if (workerSockets[data._proxiedWorkerId]) {
            workerSockets[data._proxiedWorkerId].emit('new_job', data);
          } else {
            badThings('Worker of given id not found: ' + data._proxiedWorkerId);
          }
        });
      } else {
        badThings('Multiple servers registered as a manager!');
      }
    });

    // if the socket is not the manager, add it to the worker sockets
    if (!managerSocket || managerSocket.id !== socket.id) {
      workerSockets[socket.id] = socket;
    }

    socket.on('manifest', function(data) {
      var proxySocketId = socket.id;
      data._proxiedWorkerId = proxySocketId;
      managerSocket.emit('manifest', data);
    });

    socket.on('disconnect', function() {
      // well the manager just dropped out
      if (managerSocket.id == socket.id) {
        badThings('Manager disappeard');
      } else {
        delete workerSockets[socket.id];
        managerSocket.emit('proxy_disconnect', {
          _proxiedWorkerId: socket.id
        });
      }
    });
    socket.on('job_complete', function(data) {
      var proxySocketId = socket.id;
      data._proxiedWorkerId = proxySocketId;
      managerSocket.emit('job_complete', data);
    });
    socket.on('job_progress', function(data) {
      var proxySocketId = socket.id;
      data._proxiedWorkerId = proxySocketId;
      managerSocket.emit('job_progress', data);
    });
    socket.on('job_failed', function(data) {
      var proxySocketId = socket.id;
      data._proxiedWorkerId = proxySocketId;
      managerSocket.emit('job_failed', data);
    });

  });
};