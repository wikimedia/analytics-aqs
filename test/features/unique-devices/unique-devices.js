'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, afterEach */

var assert = require('../../utils/assert.js');
var preq   = require('preq');
const TestRunner = require('../../utils/server');


describe('unique-devices endpoints', function () {
    this.timeout(20000);

    const baseURL = TestRunner.AQS_URL;

    // NOTE: this tests using the projects/aqs_default.yaml config, so
    // it doesn't know about the /metrics root like the prod config does
    var endpoint = '/unique-devices/en.wikipedia/all-sites/daily/19690101/19710101';
    var endpointWithHours = '/unique-devices/en.wikipedia/all-sites/daily/1970010100/1970010200';

    // Fake data insertion endpoints
    var insertEndpoint = '/unique-devices/insert/en.wikipedia/all-sites/daily/19700101';

    function fix(b, s, u) { return b.replace(s, s + u); }

    // Test Endpoint

    it('should return 400 when parameters are wrong', function () {
        return preq.get({
            uri: baseURL + endpoint.replace('19710101', '20150701000000')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return 400 when start is before end', function () {
        return preq.get({
            uri: baseURL + endpoint.replace('19690101', '20160701')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return 400 when timestamp is invalid', function () {
        return preq.get({
            uri: baseURL + endpoint.replace('19710101', '20150229')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    // WARNING: the data created in this test is used exactly as created
    // by the monitoring tests.
    it('should return the expected aggregate data after insertion', function () {
        return preq.post({
            uri: baseURL + insertEndpoint + '/0'
        }).then(function() {
            return preq.get({
                uri: baseURL + endpoint
            });
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepStrictEqual(res.body.items[0].devices, 0);
        });
    });

    it('should return the same data when using timestamps with hours', function () {
        return preq.get({
            uri: baseURL + endpointWithHours
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepStrictEqual(res.body.items[0].devices, 0);
        });
    });

    it('should include offset and underestimate', function () {
        return preq.get({
            uri: baseURL + endpointWithHours
        }).then(function(res) {
            assert.ok('offset' in res.body.items[0]);
            assert.ok('underestimate' in res.body.items[0]);
        });
    });

    // This test is not working: result was not an int and test was not failing.
    // It must be related to using SQLLite instead of cassandra as a backend
    it('should parse the device column string into an int', function () {
        return preq.post({
            uri: baseURL +
                 fix(insertEndpoint, 'en.wikipedia', '3') +
                 '/9007199254740991'
        }).then(function() {
            return preq.get({
                uri: baseURL +
                     fix(endpoint, 'en.wikipedia', '3')
            });
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepStrictEqual(res.body.items[0].devices, 9007199254740991);
        });
    });
});
