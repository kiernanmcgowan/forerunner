// forerunner.js
// central manager for all forerunner-workers

// module scoped vars
var _preHooks = {};
var _postHooks = {};
var _failedHooks = {};
var _currentWorker = {};
var _currentWorkerAbilities = {};

// job state
var _jobsOnSocket = {};
// buffered job queue, this way we can keep
// a certian number of jobs in mem at a time
var _jobQueue = [];

// requires
var io = require('socket.io');
// oh look, underscore. I wonder if anyone else uses this...
var _ = require('underscore');
var async = require('async');
var uuid = require('node-uuid');

var queueObject = null;
var storeObject = null;

// defaults for many things
var _forerunnerDefaults = {
  // two ts, and only one of the others
  port: 21211,
  // no job state stored by default, default to process memory
  queue: require('./util/memory_queue'),
  // and a console save
  store: require('./util/console_store'),
  // jobs can fail once
  maxFailCount: 1,
  // number of jobs to keep in the buffer at once
  queueBufferSize: 100,
  queueRefreshLimit: 0.1,
  queueRefreshRate: 1000
};

var moduleOpts = null;

// creates a new forerunner
function forerunner(opts, callback) {
  if (!callback && typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  // extent the config
  opts = _.extend(_forerunnerDefaults, opts);
  moduleOpts = opts;

  // start listening
  var managerSocket = io.listen(opts.port);
  // shaaddaup
  managerSocket.set('log level', 1);

  // set up store and saves
  queueObject = opts.queue;
  storeObject = opts.store;
  queueObject.queuedJobs(opts.queueBufferSize, function(err, jobs) {
    if (err) {
      console.error('Unable to load job queue from store');
    } else {
      _jobQueue = jobs;
    }
    process.nextTick(function() {
      callback();
    });
  });

  // new connection to the manager
  managerSocket.on('connection', function(socket) {
    // keep track of the socket
    var socketId = socket.id;
    _currentWorker[socketId] = socket;

    // after the manifest is sent, record it
    socket.on('manifest', function(data) {
      if (data.manifest && _.isArray(data.manifest)) {
        _currentWorkerAbilities[socketId] = data.manifest;
      } else {
        // wat
        console.error('Worker connected, but did not send a proper manifest');
        console.log(data);
      }
      flushQueue();
    });

    // and when it disconnects, remove it
    socket.on('disconnect', function() {
      // if the socket goes down, all jobs are lost
      invalidateJobsOnSocket(socketId, function() {
        // dont flush as there are no new workers!
      });
    });

    socket.on('job_complete', function(payload) {
      var jobId = payload.id;
      var jobResult = payload.result;
      var jobType = payload.type;

      removeJobFromSocket(socketId, jobId);
      storeObject.storeJob(jobId, jobType, jobResult, function(err) {
        if (err) {
          console.error(err);
        }
        alertPostJob(jobType, jobId, jobResult);
        queueObject.removeJob(jobId, function() {
          bufferQueue();
          flushQueue();
        });
      });
    });

    socket.on('job_failed', function(payload) {
      var jobId = payload.id;
      var message = payload.message;
      var jobType = payload.type;

      removeJobFromSocket(socketId, jobId);
      queueObject.countFailedJob(jobId, message, function(err, failCount) {
        alertFailedJob(jobType, jobId, message);
        if (moduleOpts.maxFailCount <= 0 || failCount < moduleOpts.maxFailCount) {
          // dont remove the job, we can get it later
        } else {
          queueObject.removeJob(jobId, function() {
            storeObject.failedJob(jobId, jobType, failCount, message, function(err) {
              if (err) {
                console.error(err);
              }
            });
            bufferQueue();
          });
        }
        flushQueue();
      });
    });
  });
}
module.exports.start = forerunner;

//
/// User hooks for job state
//

// adds a post job hook for a given job name
function preJob(jobName, fn) {
  pushFunctionOntoHook(_preHooks, jobName, fn);
}
module.exports.preJob = preJob;

function postJob(jobName, fn) {
  pushFunctionOntoHook(_postHooks, jobName, fn);
}
module.exports.postJob = postJob;

// listeners for a failed job
function failedJob(jobName, fn) {
  pushFunctionOntoHook(_failedHooks, jobName, fn);
}
module.exports.failedJob = failedJob;

function alertPreJob(jobName, jobId, jobData) {
  callHookedFunctions(_preHooks, jobName, [jobId, jobData]);
}

function alertPostJob(jobName, jobId, jobResult) {
  callHookedFunctions(_postHooks, jobName, [jobId, jobResult]);
}

function alertFailedJob(jobName, jobId, message) {
  callHookedFunctions(_failedHooks, jobName, [jobId, message]);
}

//
/// Plugin logic
//

function regisiterPlugin(plug) {
  var self = this;
  plug.forerunner = this;

  var hooks;
  if (typeof plug.preHooks === 'function') {
    hooks = plug.preHooks();
    _.each(hooks, function(fn, job) {
      self.preJob(job, fn);
    });
  }
  if (typeof plug.postHooks === 'function') {
    hooks = plug.postHooks();
    _.each(hooks, function(fn, job) {
      self.postJob(job, fn);
    });
  }
  if (typeof plug.failedHooks === 'function') {
    hooks = plug.failedHooks();
    _.each(hooks, function(fn, job) {
      self.failedJob(job, fn);
    });
  }
}
module.exports.regisiterPlugin = regisiterPlugin;

//
/// User functions for job def and control
//

// asks the forerunner to assign a job
// he will if he can
function assignJob(jobName, payload, callback) {
  if (!callback) {
    // noop
    callback = function() {};
  }
  // create a new jobId for the job
  queueObject.createJob(jobName, payload, function(err, jobId) {
    if (err) {
      console.error(err);
      return callback(err);
    }

    // its debounced, so we can call it as much as we want
    bufferQueue();

    // callback right when it is queued!
    callback(null, {status: 'queued'});
  });
}
module.exports.assignJob = assignJob;

//
/// Private, internal affairs.
//

function pushFunctionOntoHook(hooks, jobName, fn) {
  if (!hooks[jobName]) {
    hooks[jobName] = [];
  }
  hooks[jobName].push(fn);
}

function callHookedFunctions(hooks, jobName, argsArray) {
  if (hooks[jobName]) {
    for (var i = 0; i < hooks[jobName].length; i++) {
      hooks[jobName][i].apply(this, argsArray);
    }
  }
}


// a socket has dropped, count all jobs as failed
function invalidateJobsOnSocket(socketId, callback) {
  // clone the jobs on the socket
  if (_jobsOnSocket[socketId]) {
    var jobs = _jobsOnSocket[socketId].slice(0);
    async.each(jobs, function(jobId, cb) {
      queueObject.countFailedJob(jobId, 'socket_disconnect', function(err, failCount) {
        if (moduleOpts.maxFailCount <= 0 || failCount < moduleOpts.maxFailCount) {
          // nada
          // we don't need no DeMorgans law here
        } else {
          console.log('removing job because socket crashed');
          queueObject.removeJob(jobId, function() {
            // TODO: actually populate the job type here
            storeObject.failedJob(jobId, '', failCount, 'socket_disconnect', function(err) {
              if (err) {
                console.error(err);
              }
            });
          });
        }
        cb();
      });
    }, function() {
      delete _currentWorker[socketId];
      delete _jobsOnSocket[socketId];
      bufferQueue();
      callback();
    });
  }
}

function removeJobFromSocket(socketId, jobId) {
  var index = _jobsOnSocket[socketId].indexOf(jobId);
  _jobsOnSocket[socketId].splice(index, 1);
}

// tries to see if there is a free worker for the job type
function getFreeWorker(jobName) {
  // first get the free workers, by socket id
  var allWorkers = Object.keys(_currentWorker);
  var busyWorkers = []; //Object.keys(_jobsOnSocket);
  _.each(_jobsOnSocket, function(jobs, workerId) {
    // TODO: eventually this will be more flexible
    // and allow for many jobs per worker
    if (jobs.length > 0) {
      busyWorkers.push(workerId);
    }
  });
  var freeWorkers = _.difference(allWorkers, busyWorkers);
  for (var i = 0; i < freeWorkers.length; i++) {
    // only assign to the worker if we know what it can do
    if (_currentWorkerAbilities[freeWorkers[i]] && _currentWorkerAbilities[freeWorkers[i]].indexOf(jobName) !== -1) {
      // just return the first open worker for the job type
      return freeWorkers[i];
    }
  }
}

// assigns a job id to a worker
function assignJobToWorker(jobId, jobName, workerId, payload, callback) {
  if (!_jobsOnSocket[workerId]) {
    _jobsOnSocket[workerId] = [];
  }
  alertPreJob(jobName, jobId, payload);
  _jobsOnSocket[workerId].push(jobId);
  _currentWorker[workerId].emit('new_job', {id: jobId, type: jobName, payload: payload}, callback);
}

//
/// The next two functions are designed such that there can only be one instance of it on the call stack
/// Hence the odd use of nested functions and booleans
//

// TODO: drop this nonsense and just use setInterval
// simple is better, if we miss assigning a job for a few seconds, what ever


var queueBufferIsRunning = false;
var bufferQueue = _.debounce(function() {
  if (!queueBufferIsRunning) {
    queueBufferIsRunning = true;
    if (moduleOpts.queueRefreshLimit * moduleOpts.queueBufferSize > _jobQueue.length) {
      queueObject.queuedJobs(moduleOpts.queueBufferSize, function(err, newJobs) {
        if (err) {
          console.error('failed to add to queue');
        } else {
          _jobQueue = _.uniq(_jobQueue.concat(newJobs));
        }
        queueBufferIsRunning = false;
        flushQueue();
      });
    } else {
      queueBufferIsRunning = false;
    }
  }
}, 1000);

var flushIsRunning = false;
var runAnotherFlush = false;
var flushQueue = function() {
  // function that does the actual flush
  var _flushFn = function(_cb) {
    flushIsRunning = true;
    var eachFn = function(jobId, callback) {
      queueObject.fetchJob(jobId, function(err, jobName, jobData) {
        if (err) {
          console.log('failed to fetch job: ' + jobId);
          // there was an error fetching the job, so remove it from the _jobQueue
          var indexToSplice = _jobQueue.indexOf(jobId);
          _jobQueue.splice(indexToSplice, 1);
          return callback();
        }
        // now find a worker for the job
        var workerId = getFreeWorker(jobName);
        if (!workerId) {
          // there was no worker available, re index job
          // no worker found so that there is no need to re-queue
          callback(null);
        } else {
          // there is a worker, time to put it to send a job off!
          var indexToSplice = _jobQueue.indexOf(jobId);
          _jobQueue.splice(indexToSplice, 1);

          assignJobToWorker(jobId, jobName, workerId, jobData, function(err, ack) {
            if (err) {
              console.error('Failed to assign job to worker: ' + jobId);
            }
          });
          callback(null);
        }
      });
    };

    // clone the array b/c it will change during iteration
    var cloned = _jobQueue.slice(0);
    console.log('flushing queue, length n=' + cloned.length);
    // make sure that we don't flood the workers
    async.eachSeries(cloned, eachFn, function() {
      // check to see if we should refresh the queue
      flushIsRunning = false;
      _cb();
    });
  };

  // dont let more than one flush happen at a time
  if (!flushIsRunning) {
    _flushFn(function() {
      if (runAnotherFlush) {
        runAnotherFlush = false;
        process.nextTick(function() {
          flushQueue();
        });
      }
    });
  } else {
    runAnotherFlush = true;
  }
};
