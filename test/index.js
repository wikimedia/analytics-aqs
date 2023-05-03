'use strict';

var server = require('./utils/server.js');
const TestRunner = require('./utils/server.js');
describe('AQS', function() {
    const runner = new TestRunner();

    before(function () {
        return runner.start();
    })

    require('./features/legacy/pagecounts/pagecounts');
    require('./features/mediawiki-history-metrics/mediawiki-history-metrics');
    require('./features/pageviews/pageviews');
    require('./features/unique-devices/unique-devices');
    require('./features/mediarequests/mediarequests');
    require('./features/knowledge-gap/knowledge-gap')

    after(function() {
        return runner.stop()
    });

    // Run jshint as part of normal testing
    require('mocha-jshint')();
    // Run jscs as part of normal testing
    require('mocha-jscs')();
    require('mocha-eslint')([
        'lib',
        'sys',
        'v1'
    ]);
})

