#!/usr/bin/env node
var worker = require('../../index').worker;
var ping = require('../../index').builtin.tasks.ping;

worker.registerJobHandler('ping', ping);

// start the worker
var forerunnerLocation = process.env.FR_LOCATION || 'http://localhost:2718';
worker.start(forerunnerLocation);

