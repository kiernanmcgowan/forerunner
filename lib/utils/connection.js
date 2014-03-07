// connection
// manages a connection between the manager and a worker (or worker proxy)

var eventsModule = require('events');
var events = new eventsModule.EventEmitter();
var io = null;

function connectionPool(opts) {
  // if we set up with a proxy, we connect to them
  if (opts.proxyLocation) {
    io = require('socket.io-client');
    this.managerSocket = io.connect(opts.proxyLocation);
    setUpEventListeners(this.managerSocket, true);
    this.managerSocket.emit('manager_register');
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
  events.addListener(message, fn);
}
module.exports.on = on;

function socketProxy(socket, proxyId) {
  this.socket = socket;
  this.id = socket.id || proxyId;
  this.proxyId = proxyId;
  var self = this;
  this.emit = function(message, data) {
    data._proxiedWorkerId = self.proxyId;
    socket.emit(message, data);
  };
  this.on = function(message, callback) {
    socket.on(message, callback);
  };
}

function newJob(socket, workerId, payload, callback) {
  payload._proxiedWorkerId = workerId;
  socket.emit('new_job', payload, callback);
}
module.exports.newJob = newJob;

// binds some events to a socket object
function setUpEventListeners(socket, useProxy) {
  socket.on('manifest', function(data) {
    events.emit('manifest', {
      socketId: socket.id || data._proxiedWorkerId,
      socket: socket,
      data: data
    });
  });
  socket.on('disconnect', function() {
    events.emit('disconnect', {
      socketId: socket.id
    });
  });
  socket.on('proxy_disconnect', function(data) {
    events.emit('disconnect', {
      socketId: socket.id || data._proxiedWorkerId
    });
  });
  socket.on('job_complete', function(data) {
    events.emit('job_complete', {
      socketId: socket.id || data._proxiedWorkerId,
      data: data
    });
  });
  socket.on('job_progress', function(data) {
    events.emit('job_progress', {
      socketId: socket.id || data._proxiedWorkerId,
      data: data
    });
  });
  socket.on('job_failed', function(data) {
    events.emit('job_failed', {
      socketId: socket.id || data._proxiedWorkerId,
      data: data
    });
  });
  /*socket.on('error', function(data) {
    console.error('error on socket! ' + socket.id);
    console.error(data);
  });
  socket.on('reconnect', function(data) {
    console.log('reconnected on socket: ' + socket.id);
  });
  socket.on('reconnecting', function(data) {
    console.log('attempting to reconnect on socket: ' + socket.id);
  });*/
}
