#!/usr/bin/env node

// example - harbinger web crawl

var harbinger = require('../../../index').harbinger;
var path = require('path');

// basic set up
harbinger.start({}, function() {

  harbinger.preJob('fetch_file', function(id, data) {
    console.log('queued: ' + data.url);
  });

  harbinger.postJob('fetch_file', function(id, data) {
    console.log('fetch_file is done: ' + id);
    console.log(data);
  });

  /*harbinger.assignJob('fetch_file', {
    origin: 'http://s.gravatar.com/avatar/f3ee6692e740eb485002adbb33bc2fa0?s=80&r=g',
    destination: process.env.HOME
  }, function(err, status) {

  });*/

  harbinger.assignJob('targz', {
    origin: path.join(process.env.HOME, 'code_json'),
    destination: path.join(process.env.HOME, 'code_json.tar')
  }, function(id, tar) {
    console.log('derp');
  });

});