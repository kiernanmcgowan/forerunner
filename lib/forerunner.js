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

var queueObject = null;
var storeObject = null;
var logger = null;

// defaults for many things
var _forerunnerDefaults = {
  // natural base is a good port to use
  port: 2718,
  // no job state stored by default, default to process memory
  queue: require('./builtins/queue/memory_queue'),
  // and a console save
  store: require('./builtins/store/memory_store'),
  flushCount: 10,
  flushInterval: 1000,
  // jobs can fail once
  maxFailCount: 1,
  logger: console
};

var moduleOpts = null;

// creates a new forerunner
function forerunner(opts) {
  if (!opts) {
    opts = {};
  }
  // extent the config
  opts = _.extend(_forerunnerDefaults, opts);
  moduleOpts = opts;

  updateFlushIntervalTime(moduleOpts.flushInterval)

  // start listening
  var managerSocket = io.listen(opts.port);
  // shaaddaup
  managerSocket.set('log level', 1);

  // set up store and saves
  queueObject = opts.queue;
  storeObject = opts.store;
  logger = opts.logger;

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
      });
    });

    socket.on('job_progress', function(payload) {
      var jobId = payload.id;
      var progress = payload.progress;

      storeObject.progress(jobId, progress, function(err) {
        if (err) {
          logger.error('Forerunner store failed to record job progress');
          logger.error(err);
        }
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
          });
        }
      });
    });
  });
}
module.exports.start = forerunner;

//
/// User hooks for job state
//

// adds a post job hook for a given job name
function preJob(jobType, fn) {
  pushFunctionOntoHook(_preHooks, jobType, fn);
}
module.exports.preJob = preJob;

function postJob(jobType, fn) {
  pushFunctionOntoHook(_postHooks, jobType, fn);
}
module.exports.postJob = postJob;

// listeners for a failed job
function failedJob(jobType, fn) {
  pushFunctionOntoHook(_failedHooks, jobType, fn);
}
module.exports.failedJob = failedJob;

function alertPreJob(jobType, jobId, jobData) {
  callHookedFunctions(_preHooks, jobType, [jobId, jobData]);
}

function alertPostJob(jobType, jobId, jobResult) {
  callHookedFunctions(_postHooks, jobType, [jobId, jobResult]);
}

function alertFailedJob(jobType, jobId, message) {
  callHookedFunctions(_failedHooks, jobType, [jobId, message]);
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
function assignJob(jobType, payload, callback) {
  if (!callback) {
    // noop
    callback = function() {};
  }

  storeObject.create(jobType, jobData, function(err, jobId) {
    if (err) {
      logger.error('Forerunner - failed to create job in db');
      logger.error(JSON.stringify(err, null, 2));
      return callback(err);
    }
    // create a new jobId for the job
    queueObject.push(jobId, jobType, payload, function(err) {
      if (err) {
        logger.error('Forerunner - failed to push job to queue');
        logger.error(JSON.stringify(err, null, 2));
        return callback(err);
      }

      // callback right when it is queued!
      callback(null, jobId);
    });
  });

}
module.exports.assignJob = assignJob;

//
/// Private, internal affairs.
//

function pushFunctionOntoHook(hooks, jobType, fn) {
  if (!hooks[jobType]) {
    hooks[jobType] = [];
  }
  hooks[jobType].push(fn);
}

function callHookedFunctions(hooks, jobType, argsArray) {
  if (hooks[jobType]) {
    for (var i = 0; i < hooks[jobType].length; i++) {
      hooks[jobType][i].apply(this, argsArray);
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
function getFreeWorker(jobType) {
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
    if (_currentWorkerAbilities[freeWorkers[i]] && _currentWorkerAbilities[freeWorkers[i]].indexOf(jobType) !== -1) {
      // just return the first open worker for the job type
      return freeWorkers[i];
    }
  }
}

// assigns a job id to a worker
function assignJobToWorker(jobId, jobType, workerId, payload, callback) {
  if (!_jobsOnSocket[workerId]) {
    _jobsOnSocket[workerId] = [];
  }
  alertPreJob(jobType, jobId, payload);
  _jobsOnSocket[workerId].push(jobId);
  _currentWorker[workerId].emit('new_job', {id: jobId, type: jobType, payload: payload}, callback);
}



var flushIsRunning = false;
var flushIntervalId;

function updateFlushIntervalTime(inverval) {
  if (flushIntervalId) {
    clearInverval(flushIntervalId);
  }
  flushIntervalId = setInterval(function() {
    flushQueue();
  }, inverval)
}

function flushQueue() {
  // only allow one flush as a time (because there is a lot of async stuff flying around)
  if (!flushIsRunning) {
    flushIsRunning = true;
    logger.info('Forerunner - flushing queue');
    queueObject.each(moduleOpts.flushCount, function(jobId, jobType, jobPayload) {
      var workerId = getFreeWorker(jobType);
      if (workerId) {
        assignJobToWorker(jobId, jobType, workerId, jobData, function(err, ack) {
          if (err) {
            logger.error('Forerunner - Failed to assign job to worker: ' + jobId);
            logger.error(JSON.stringify(err, null, 2));
          }
        });
      } else {
        // put it back in the queue
        queueObject.requeue(jobId, jobType, jobPayload, function(err) {
          if (err) {
            logger.error('Forerunner - FAILED TO REQUEUE JOB! THE JOB WAS LOST FROM THE QUEUE!');
            logger.error(JSON.stringify(err, null, 2));
          }
        });
      }
    }, function(err) {
      if (err) {
        logger.error('Forerunner - error when flushing queue');
        logger.error(JSON.stringify(err, null, 2));
      }
      logger.info('Forerunner - finished flushing queue');
      flushIsRunning = false;
    });
  } else {
    logger.info('Forerunner - tried to flush queue, but it is already flushing');
    logger.info('Forerunner - adjust your flushCount or flushInverval params?');
  }
};
