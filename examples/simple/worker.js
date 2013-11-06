#!/usr/bin/env node
var worker = require('../../index').worker;
var ping = require('../../index').builtin.tasks.ping;

// register a job handler for the scraping
worker.registerJobHandler('ping', ping);

// start the worker
var forerunnerLocation = 'http://localhost:2718';
worker.start(forerunnerLocation);

