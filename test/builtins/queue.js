// queue tests
var testSuite = require('forerunner-queue-tests');

var queue = require('../../index').builtin.queue.memory;

testSuite(queue, function(results) {
  process.exit(results.broken);
});