'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, afterEach */

var assertBase = require('assert');
var assert = require('../../utils/assert.js');
var preq   = require('preq');
const TestRunner = require('../../utils/server');

/*
  In order to be able to fake a druid endpoint inside AQS,
  we need the test data (fixtures) to be available not only
  in this test file but also in the fake_druid.js one.
  Therefore this file is only a loop reading fixtures from
  other files and comparing results against expected.
  See edits_fitures.js for actual test data.
*/
var fixtures = require('./fixtures.js');


describe('mediawiki-history-metrics endpoints', function() {
    this.timeout(20000);

    const baseURL = TestRunner.AQS_URL;

    var makeTest = function(fixture) {
        it(fixture.describe, () => {
            var uri = baseURL + fixture.aqsEndpoint;
            return preq.get({
                uri: uri
            }).then(res => {
                if (fixture.expectedAqsResult) {
                    assertBase.strictEqual(res.status, fixture.expectedAqsResult.status);
                    assert.deepEqual(res.body, fixture.expectedAqsResult.body);
                }
            }).catch(res => {
                if (fixture.expectedAqsResult) {
                    assertBase.strictEqual(res.status, fixture.expectedAqsResult.status);
                }
            });
        });
    }

    for (var i in fixtures.values) {
        makeTest(fixtures.values[i]);
    }

});
