#!/usr/bin/env node

var forerunner = require('../../index').forerunner;

var proxyLocation = process.env.FR_PROXY || 'http://localhost:2718';

// basic set up with defaults
forerunner.start({
  proxyLocation: proxyLocation
});

// post job hook
forerunner.onComplete('ping', function(id, data) {
  console.log('ping\'ed worker with job id: ' + id);
  forerunner.assignJob('ping', {cat: 'dog'}, function(err, status) {
    if (err) {
      console.log('failed to add job reaction ping job');
    }
  });
});

// assign a new job to the worker pool
forerunner.assignJob('ping', {foo: 'bar'}, function(err, status) {
  if (err) {
    console.log('failed to add job initial ping job');
  }
});
