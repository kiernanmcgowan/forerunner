// key_map
// maps keys from input to output
// to help with job composition

var _ = require('underscore');

module.exports = function(transfer) {
  var inputKeys = Object.keys(transfer);
  var outputKeys = [];

  for (var i = 0; i < inputKeys.length; i++) {
    outputKeys.push(inputKeys[i]);
  }

  return function(id, type, data, callback) {
    var output = {};
    var source = data.source;
    var allinputKeys = Object.keys(source);
    var keysToNotTouch = _.difference(allinputKeys, inputKeys);

    for (var j = 0; j < inputKeys.length; j++) {
      output[outputKeys[j]] = source[inputKeys[j]];
    }

    for (var k = 0; k < keysToNotTouch.length; k++) {
      output[keysToNotTouch[k]] = source[keysToNotTouch[k]];
    }

    return callback(null, output);
  };
};