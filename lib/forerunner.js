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
  flushInterval: 5000,
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
  //managerSocket.set('log level', 1);

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
      logger.info('Forerunner - recived manifest from worker on socket ' + socketId);
      if (data.manifest && _.isArray(data.manifest)) {
        _currentWorkerAbilities[socketId] = data.manifest;
      } else {
        // wat
        logger.error('Worker connected, but did not send a proper manifest');
        logger.log(data);
      }
    });

    // and when it disconnects, remove it
    socket.on('disconnect', function() {
      logger.info('Forerunner - worker disconnected socketId: ' + socketId);
      // if the socket goes down, all jobs are lost
      invalidateJobsOnSocket(socketId, function() {
        // dont flush as there are no new workers!
      });
    });

    socket.on('job_complete', function(payload) {
      var jobId = payload.id;
      var jobResult = payload.result;
      var jobType = payload.type;

      logger.info('Forerunner - job complete ' + jobType + ':' + jobId);

      removeJobFromSocket(socketId, jobId);
      storeObject.complete(jobId, jobResult, function(err) {
        if (err) {
          console.error(err);
        }
        alertPostJob(jobType, jobId, jobResult);
      });
    });

    socket.on('job_progress', function(payload) {
      var jobId = payload.id;
      var progress = payload.progress;

      logger.info('Forerunner - job progress ' + jobId + ' ' + progress);

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

      logger.error('Forerunner - job failed ' + jobId + ' ' + message);

      var job = removeJobFromSocket(socketId, jobId);
      storeObject.countFailed(jobId, message, function(err, failCount) {
        alertFailedJob(job.type, jobId, message);
        if (moduleOpts.maxFailCount <= 0 || failCount < moduleOpts.maxFailCount) {
          // requeue the job
          queueObject.requeue(jobId, job.type, job.payload, function(err) {
            if (err) {
              logger.error('Forerunner - FAILED TO REQUEUE JOB! THE JOB WAS LOST FROM THE QUEUE!');
              logger.error(JSON.stringify(err, null, 2));
            }
            logger.info('Forerunner - job re-queued ' + jobId);
          });
        } else {
          logger.error('Forerunner - job failed too many times ' + jobId);
          storeObject.failed(jobId, function(err) {
            if (err) {
              console.error(err);
            }
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
function assignJob(jobType, jobData, callback) {
  if (!callback) {
    // noop
    callback = function() {};
  }

  storeObject.create(jobType, jobData, function(err, jobId, normalizedJobData) {
    if (err) {
      logger.error('Forerunner - failed to create job in store');
      logger.error(JSON.stringify(err, null, 2));
      return callback(err);
    }
    logger.info('Forerunner - created new job of type and id ' + jobType + ' ' + jobId);
    // if the store provides normalizedJobData then use that instead
    if (normalizedJobData) {
      logger.info('Forerunner - store modified job data for job: ' + jobId);
      jobData = normalizedJobData;
    }
    // create a new jobId for the job
    queueObject.push(jobId, jobType, jobData, function(err) {
      if (err) {
        logger.error('Forerunner - failed to push job to queue');
        logger.error(JSON.stringify(err, null, 2));
        return callback(err);
      }
      logger.info('Forerunner - queued job of type:id ' + jobType + ':' + jobId);
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
  logger.info('Forerunner - invalidating jobs on socket: ' + socketId);
  // clone the jobs on the socket
  if (_jobsOnSocket[socketId]) {
    var jobs = _jobsOnSocket[socketId].slice(0);
    async.each(jobs, function(jobObject, cb) {
      storeObject.countFailed(jobObject.id, 'socket_disconnect', function(err, failCount) {
        if (moduleOpts.maxFailCount <= 0 || failCount < moduleOpts.maxFailCount) {
          // nada
          // we don't need no DeMorgans law here
          queueObject.requeue(jobObject.id, jobObject.type, jobObject.payload, function(err) {
            if (err) {
              logger.error('Forerunner - FAILED TO REQUEUE JOB! THE JOB WAS LOST FROM THE QUEUE!');
              logger.error(JSON.stringify(err, null, 2));
            }
          });
        } else {
          storeObject.failed(jobObject.id, function(err) {
            if (err) {
              console.error(err);
            }
          });
        }
        cb();
      });
    }, function() {
      delete _currentWorker[socketId];
      delete _jobsOnSocket[socketId];
      callback();
    });
  }
}

function removeJobFromSocket(socketId, jobId) {
  var jobIdList = _.pluck(_jobsOnSocket[socketId], 'id');
  var index = jobIdList.indexOf(jobId);
  return _jobsOnSocket[socketId].splice(index, 1);
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
  _jobsOnSocket[workerId].push({id: jobId, type: jobType, payload: payload});
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
    queueObject.each(moduleOpts.flushCount, function(jobId, jobType, jobData) {
      var workerId = getFreeWorker(jobType);
      if (workerId) {
        logger.info('Forerunner - worker found assigning job ' + jobId);
        assignJobToWorker(jobId, jobType, workerId, jobData, function(err, ack) {
          if (err) {
            logger.error('Forerunner - Failed to assign job to worker: ' + jobId);
            logger.error(JSON.stringify(err, null, 2));
          } else {
            logger.info('Forerunner - job successfully assigned to worker ' + jobId);
          }
        });
      } else {
        // put it back in the queue
        queueObject.requeue(jobId, jobType, jobData, function(err) {
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
