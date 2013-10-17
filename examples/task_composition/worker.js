#!/usr/bin/env node

// example - forerunner task composition example
// creates a job that is a mixture of several different tasks

var worker = require('../../index').worker;
var fetch = require('../../index').builtin.tasks.fetch;
var targz = require('../../index').builtin.tasks.targz;

// register job handlers
worker.registerJobHandler('fetch', fetch);
worker.registerJobHandler('targz', targz);

// now create a composition
worker.registerJobHandler('download_and_archive', worker.compose([
  'fetch',
  function(id, type, data, callback) {
    // alter the keys of the returned values to match the targz call
    callback(null, {origin: data.destination, destination: data.tarDestination});
  },
  'targz'
]));

// start the worker
var forerunnerLocation = 'http://localhost:2718';
worker.start(forerunnerLocation);
