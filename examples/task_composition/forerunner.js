#!/usr/bin/env node

// example - forerunner task composition example
// creates a job that is a mixture of several different tasks

var forerunner = require('../../index').forerunner;
var path = require('path');

// basic set up
forerunner.start({}, function() {

  forerunner.preJob('download_and_archive', function(id, data) {
    console.log('queued: ' + id);
  });

  forerunner.postJob('download_and_archive', function(id, data) {
    console.log('fetch_file is done: ' + id);
    console.log(data);
  });

  forerunner.assignJob('download_and_archive', {
    origin: [
      'http://s.gravatar.com/avatar/f3ee6692e740eb485002adbb33bc2fa0',
      'http://0.gravatar.com/avatar/60fad29372e8b57efa608815c6529fa1',
      'http://0.gravatar.com/avatar/f29d69cc26b0bfb80b12d3d32ec1cd61'
    ],
    destination: path.join(process.env.HOME, 'tmp'),
    tarDestination: path.join(process.env.HOME, 'tmp.tar.gz')
  }, function(id, tar) {

  });

});