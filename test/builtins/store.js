// store tests
var testSuite = require('forerunner-store-tests');

var store = require('../../index').builtin.store.memory;

testSuite(store, function(results) {
  process.exit(results.broken);
});