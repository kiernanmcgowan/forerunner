// harbinger.js
// central manager for all harbinger-workers

// module scoped vars
var _preHooks = {};
var _postHooks = {};
var _failedHooks = {};
var _currentWorker = {};
var _currentWorkerAbilities = {};

// job state
var _jobTypes = [];
var _jobDefs = {};
var _jobsOnSocket = {};
var _jobQueue = [];

// requires
var io = require('socket.io');
// oh look, underscore. I wonder if anyone else uses this...
var _ = require('underscore');
var async = require('async');
var uuid = require('node-uuid');

var store = null;
var MAX_FAIL_COUNT = 0;

// defaults for many things
var _harbingerDefaults = {
  // two ts, and only one of the others
  port: 21211,
  // no job state stored by default, default to process memory
  store: './util/memory_store',
  // and a console save
  save: './util/console_save',
  // keep trying jobs forever
  maxFailCount: 0
};

// creates a new harbinger
function harbinger(opts, callback) {
  if (!opts) {
    opts = {};
  }
  // extent the config
  opts = _.extend(opts, _harbingerDefaults);
  MAX_FAIL_COUNT = opts.maxFailCount;

  // start listening
  var managerSocket = io.listen(opts.port);
  managerSocket.set('log level', 1);

  // set up store and saves
  store = require('./store');
  store(opts.store, opts.save, function() {
    // store is set up, lets populate our queue
    /*store.queuedJobs(function(err, jobs) {
      if (err) {
        console.error('Unable to load job queue from store');
      } else {
        _jobQueue = jobs;
      }
    });*/
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
        console.error('Worker connected, but did not send a manifest');
        console.log(data);
      }
      flushQueue();
    });

    // and when it disconnects, remove it
    socket.on('disconnect', function() {
      // if the socket goes down, all jobs are lost
      invalidateJobsOnSocket(socketId);
      delete _currentWorker[socketId];
      delete _jobsOnSocket[socketId];
    });

    socket.on('job_complete', function(payload) {
      var jobId = payload.id;
      var jobResult = payload.result;
      var jobType = payload.type;

      removeJobFromSocket(socketId, jobId);
      store.storeJob(jobId, jobResult, function(err) {
        if (err) {
          console.error(err);
        }
        alertPostJob(jobType, jobId, jobResult);
        flushQueue();
      });
    });

    socket.on('job_failed', function(payload) {
      var jobId = payload.id;
      var message = payload.message;
      var jobType = payload.type;

      removeJobFromSocket(socketId, jobId);
      store.countFailedJob(jobId, message, function(err, failCount) {
        alertFailedJob(jobType, jobId, message);
        if (failCount < MAX_FAIL_COUNT) {
          queueJob(jobId, true);
          flushQueue();
        } else {
          console.log('Job ' + jobId + ' has failed to many times');
        }
      });
    });
  });

}
module.exports.start = harbinger;

//
/// User hooks for job state
//

// adds a post job hook for a given job name
function preJob(jobName, fn) {
  if (!_preHooks[jobName]) {
    _preHooks[jobName] = [];
  }
  _preHooks[jobName].push(fn);
}
module.exports.preJob = preJob;

function postJob(jobName, fn) {
  if (!_postHooks[jobName]) {
    _postHooks[jobName] = [];
  }
  _postHooks[jobName].push(fn);
}
module.exports.postJob = postJob;

// listeners for a failed job
function failedJob(jobName, fn) {
  if (!_failedHooks[jobName]) {
    _failedHooks[jobName] = [];
  }
  _failedHooks[jobName].push(fn);
}
module.exports.failedJob = failedJob;

function alertPreJob(jobName, jobId, jobData) {
  if (_preHooks[jobName]) {
    for (var i = 0; i < _preHooks[jobName].length; i++) {
      _preHooks[jobName][i](jobId, jobData);
    }
  }
}

function alertPostJob(jobName, jobId, jobData) {
  if (_postHooks[jobName]) {
    for (var i = 0; i < _postHooks[jobName].length; i++) {
      _postHooks[jobName][i](jobId, jobData);
    }
  }
}

function alertFailedJob(jobName, jobId, message) {
  if (_failedHooks[jobName]) {
    for (var i = 0; i < _failedHooks[jobName].length; i++) {
      _failedHooks[jobName][i](jobId, message);
    }
  }
}

//
/// User functions for job def and control
//

// defines a job and how the harbinger should behave to it
function defineJob(jobName, jobDef) {
  if (typeof jobName !== 'string' || typeof jobDef !== 'object') {
    throw new Error('Name must be a string and def must be an object, you stupid monkey');
  }
  __jobDefs[jobName] = jobDef;
}

// asks the harbinger to assign a job
// he will if he can
function assignJob(jobName, payload, callback) {
  // create a new jobId for the job
  store.createJob(jobName, payload, function(err, jobId) {
    if (err) {
      console.error(err);
      return callback(err);
    }

    queueJob(jobId);

    flushQueue();

    callback(null, {status: 'queued'});
  });
}
module.exports.assignJob = assignJob;

//
/// Private, internal affairs. STAP LOOKEN
//

// a socket has dropped, count all jobs as failed
function invalidateJobsOnSocket(socketId) {
  var jobs = _jobsOnSocket[socketId];
  var counter = 0;
  _.each(jobs, function(jobId) {
    counter++;
    // use process next tick in case some dumdum calls the callback synchronously
    process.nextTick(function() {
      store.countFailedJob(jobId, 'socket_disconnect', function(err, failCount) {
        counter--;
        if (MAX_FAIL_COUNT <= 0 || failCount < MAX_FAIL_COUNT) {
          queueJob(jobId, true);
        } else {
          console.log('fail count to high');
          console.log(failCount);
          console.log(MAX_FAIL_COUNT);
        }

        // when we have found all the orphans, try and flush the queue
        if (counter <= 0) {
          flushQueue();
        }
      });
    });
  });
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
  _.each(_jobsOnSocket, function(workerId, jobs) {
    // TODO: eventually this will be more flexible
    // and allow for many jobs per worker
    if (jobs.length > 0) {
      busyWorkers.push(workerId);
    }
  });
  var freeWorkers = _.difference(allWorkers, busyWorkers);
  for (var i = 0; i < freeWorkers.length; i++) {
    if (_currentWorkerAbilities[freeWorkers[i]].indexOf(jobName) !== -1) {
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

function queueJob(jobId, front) {
  if (front) {
    _jobQueue.unshift(jobId);
  } else {
    _jobQueue.push(jobId);
  }
}

// we should assign jobs to workers now
// gives priority to orphaned jobs
function flushQueue() {
  var eachFn = function(jobId, callback) {
    store.fetchJob(jobId, function(err, jobName, jobData) {
      if (err) {
        console.error(err);
        return callback();
      }
      // now find a worker for the job
      var workerId = getFreeWorker(jobName);
      if (!workerId) {
        // there was no worker available, re index job
        // no worker found so that there is no need to requeue
        //queueJob(jobId, true);
        callback(null);
      } else {
        // there is a worker, time to put it to send a job off!
        var indexToSplice = _jobQueue.indexOf(jobId);
        _jobQueue.splice(indexToSplice, 1);

        assignJobToWorker(jobId, jobName, workerId, jobData, function(err, ack) {
          if (err) {
            console.error('failed to give job to worker');
            console.error(err);
            callback(null);
          } else {
            callback(null);
          }
        });
      }
    });
  };

  var cloned = _jobQueue.slice(0);

  // make sure that we dont flood the workers
  async.eachSeries(cloned, eachFn, function() {

  });
}
