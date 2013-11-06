// connection
// manages a connection between the manager and a worker (or worker proxy)

var events = require('events').EventEmitter;
var io = null; //require('socket.io');


function connectionPool(opts) {
  // if we set up with a proxy, we connect to them
  if (opts.proxyLocation) {
    io = require('socket.io-client');
    this.managerSocket = io.connect(opts.proxyLocation);
    setUpEventListeners(this.managerSocket);
  } else if (opts.port) {
    io = require('socket.io');
    this.managerSocket = io.listen(opts.port);
    this.managerSocket.on('connection', function(socket) {
      setUpEventListeners(socket);
    });
  } else {
    throw new Error('Connection pool either needs a proxy location, or a port to listen on');
  }
}
module.exports.start = connectionPool;

function on(message, fn) {
  events.on(message, fn);
}
module.exports.on = on;

// binds some events to a socket object
function setUpEventListeners(socket) {
  socket.on('manifest', function(data) {
    events.emit('manifest', {
      socketId: socketId,
      data: data
    });
  });
  socket.on('disconnect', function(data) {
    events.emit('disconnect', {
      socketId: socketId,
      data: data
    });
  });
  socket.on('job_complete', function(data) {
    events.emit('job_complete', {
      socketId: socketId,
      data: data
    });
  });
  socket.on('job_progress', function(data) {
    events.emit('job_progress', {
      socketId: socketId,
      data: data
    });
  });
  socket.on('job_failed', function(data) {
    events.emit('job_failed', {
      socketId: socketId,
      data: data
    });
  });
}
