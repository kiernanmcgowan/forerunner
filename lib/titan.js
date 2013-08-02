// titan.js
// central manager for all titan-workers


// module scoped vars
var _preHooks = {};
var _postHooks = {};
var _failedHookes = {};
var _currentSlaves = {};
var _currentSlavesAbilities = {};
var _orphandJobs = {};

// job state
var _jobTypes = [];
var _jobDefs = {};
var _jobsOnSocket = {};

// carefull with these!
var __jobDefs = {};

// requires
var io = require('socket.io');
// oh look, underscore. I wonder if anyone else uses this...
var _ = require('underscore');
var uuid = require('node-uuid');

// defaults for many things
var _titanDefaults = {
  // two t's, and only one of the others
  port: 21211,
  // all job state is is redis by default
  orphandStore: 'redis',
  completeStore: 'redis',
  failedStore: 'redis'
};

// creates a new titan
function titan(opts) {
  // extent the config
  opts = _.extend(opts, _titanDefaults);
  // start listening
  var managerSocket = io.listen(opts.port);

  // set up stores


  // new connection to the manager
  managerSocket.on('connection', function(socket) {
    // keep track of the socket
    var socketId = socket.id;
    _currentSlaves[socketId] = socket;

    // after the manifest is sent, record it
    socket.on('manifest', function(data) {
      if (data.jobs && _.isArray(data.jobs)) {
        _currentSlavesAbilities[socketId] = data.jobs;
      }
    });

    // and when it disconnects, remove it
    socket.on('disconnect', function() {
      // if the socket goes down, all jobs are lost
      invalidateJobsOnSocket(socketId);
      delete _currentSlaves[socketId];
    });
  });
}

//
/// User hooks for job state
//

// adds a pre job hook for a given job name
function preJob(jobName, fn) {
  if (!_preHooks[jobName]) {
    _preHooks[jobName] = [];
  }
  _preHooks.push(fn);
}

// adds a post job hook for a given job name
function postJob(jobName, fn) {
  if (!_postHooks[jobName]) {
    _postHooks[jobName] = [];
  }
  _postHooks.push(fn);
}

// listeners for a failed job
function failedJob(jobName, fn) {
  if (!_failedHooks[jobName]) {
    _failedHooks[jobName] = [];
  }
  _failedHooks.push(fn);
}

//
/// User fns for job def and control
//

// defines a job and how the titan should behave to it
function defineJob(jobName, jobDef) {
  if (typeof jobName !== 'string' || typeof jobDef !== 'object') {
    throw new Error('Name must be a string and def must be an object, you stupid monkey');
  }
  var __jobDefs[jobName] = jobDef;
}

// asks the titan to assign a job
// he will if he can
function assignJob(jobName, payload, callback) {
  // create a new jobId for the job
  var jobId = createJob(jobName, payload);;
}

//
/// Private, interal affairs. STAP LOOKEN
//

// a socket has dropped, count all jobs as failed
function invalidateJobsOnSocket(socketId) {
  var jobs = _jobsOnSocket[socketId];
  _.each(jobs, function(jobId) {
    _orphandJobs.push(jobId);
  });
}

// trys to see if there is a free worker for the job type
function getFreeWorker(jobName) {

}

// we should assign jobs to workers now
function flushQueue() {

}
