'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, afterEach */

var assert = require('../../../utils/assert.js');
var preq   = require('preq');
const TestRunner = require('../../../utils/server');

describe('legacy pagecounts aggregate endpoint', function () {
    this.timeout(20000);
    const baseURL = TestRunner.AQS_URL;

    function URL (project, accessSite, granularity, start, end) {
        return (baseURL + '/legacy/pagecounts/aggregate/' + project + '/' +
            accessSite + '/' + granularity + '/' + start + '/' + end);
    }

    function insertURL (project, accessSite, granularity, timestamp, count) {
        return (baseURL + '/legacy/pagecounts/insert-aggregate/' + project + '/' +
            accessSite + '/' + granularity + '/' + timestamp + '/' + count);
    }

    function insert (project, accessSite, granularity, data) {
        var promises = data.map(function (elem) {
            return preq.post({
                uri: insertURL(project, accessSite, granularity, elem[0], elem[1])
            });
        });
        return Promise.all(promises);
    }
    // Note: To avoid that fake data inserted by a test disturbs other tests,
    // we can submit an after() function that stops the server. However,
    // when doing that, the npm test logs are too verbose and break the legibility
    // of its output. So, to avoid data collisions, each test here uses a different
    // project: en.wikipedia, de.wiktionary, es.wikibooks, etc.

    it('should return requested hourly data', function () {
        var data = [
            ['2017010100', 1],
            ['2017010101', 2],
            ['2017010102', 3],
            ['2017010103', 4],
            ['2017010104', 5]
        ];
        return insert('en.wikipedia', 'all-sites', 'hourly', data).then(function (res) {
            return preq.get({
                uri: URL('en.wikipedia', 'all-sites', 'hourly', '2017010101', '2017010103')
            });
        }).then(function (res) {
            var items = res.body.items;
            assert.deepEqual(items.length, 3);
            data.slice(1, 4).forEach(function (elem, idx) {
                assert.deepEqual(items[idx].project, 'en.wikipedia');
                assert.deepEqual(items[idx]['access-site'], 'all-sites');
                assert.deepEqual(items[idx].granularity, 'hourly');
                assert.deepEqual(items[idx].timestamp, elem[0]);
                assert.deepEqual(items[idx].count, elem[1]);
            });
        });
    });

    it('should return requested daily data', function () {
        var data = [
            ['2017010100', 1],
            ['2017010200', 2],
            ['2017010300', 3],
            ['2017010400', 4],
            ['2017010500', 5]
        ];
        return insert('de.wikipedia', 'desktop-site', 'daily', data).then(function (res) {
            return preq.get({
                uri: URL('de.wikipedia', 'desktop-site', 'daily', '2017010200', '2017010400')
            });
        }).then(function (res) {
            var items = res.body.items;
            assert.deepEqual(items.length, 3);
            data.slice(1, 4).forEach(function (elem, idx) {
                assert.deepEqual(items[idx].project, 'de.wikipedia');
                assert.deepEqual(items[idx]['access-site'], 'desktop-site');
                assert.deepEqual(items[idx].granularity, 'daily');
                assert.deepEqual(items[idx].timestamp, elem[0]);
                assert.deepEqual(items[idx].count, elem[1]);
            });
        });
    });

    // As opposed to the hourly and daily granularities where the end timestamp
    // is inclusive, the monthly granularity expects an exclusive end timestamp.
    // This may be changed in the future, but for now this test obides this rule.
    it('should return requested monthly data', function () {
        var data = [
            ['2017010100', 1],
            ['2017020100', 2],
            ['2017030100', 3],
            ['2017040100', 4],
            ['2017050100', 5]
        ];
        return insert('es.wikipedia', 'mobile-site', 'monthly', data).then(function (res) {
            return preq.get({
                uri: URL('es.wikipedia', 'mobile-site', 'monthly', '2017020100', '2017040100')
            });
        }).then(function (res) {
            var items = res.body.items;
            assert.deepEqual(items.length, 2);
            data.slice(1, 3).forEach(function (elem, idx) {
                assert.deepEqual(items[idx].project, 'es.wikipedia');
                assert.deepEqual(items[idx]['access-site'], 'mobile-site');
                assert.deepEqual(items[idx].granularity, 'monthly');
                assert.deepEqual(items[idx].timestamp, elem[0]);
                assert.deepEqual(items[idx].count, elem[1]);
            });
        });
    });

    it('should return partial results when range exceeds hourly data', function () {
        var data = [
            ['2017010101', 1],
            ['2017010102', 2],
            ['2017010103', 3]
        ];
        return insert('pt.wikipedia', 'all-sites', 'hourly', data).then(function (res) {
            return preq.get({
                uri: URL('pt.wikipedia', 'all-sites', 'hourly', '2017010100', '2017010104')
            });
        }).then(function (res) {
            var items = res.body.items;
            assert.deepEqual(items.length, 3);
            data.forEach(function (elem, idx) {
                assert.deepEqual(items[idx].project, 'pt.wikipedia');
                assert.deepEqual(items[idx]['access-site'], 'all-sites');
                assert.deepEqual(items[idx].granularity, 'hourly');
                assert.deepEqual(items[idx].timestamp, elem[0]);
                assert.deepEqual(items[idx].count, elem[1]);
            });
        });
    });

    it('should return partial results when range exceeds daily data', function () {
        var data = [
            ['2017010200', 1],
            ['2017010300', 2],
            ['2017010400', 3]
        ];
        return insert('ca.wikipedia', 'desktop-site', 'daily', data).then(function (res) {
            return preq.get({
                uri: URL('ca.wikipedia', 'desktop-site', 'daily', '2017010100', '2017010500')
            });
        }).then(function (res) {
            var items = res.body.items;
            assert.deepEqual(items.length, 3);
            data.forEach(function (elem, idx) {
                assert.deepEqual(items[idx].project, 'ca.wikipedia');
                assert.deepEqual(items[idx]['access-site'], 'desktop-site');
                assert.deepEqual(items[idx].granularity, 'daily');
                assert.deepEqual(items[idx].timestamp, elem[0]);
                assert.deepEqual(items[idx].count, elem[1]);
            });
        });
    });

    it('should return partial results when range exceeds monthly data', function () {
        var data = [
            ['2017020100', 1],
            ['2017030100', 2],
            ['2017040100', 3]
        ];
        return insert('ro.wikipedia', 'mobile-site', 'monthly', data).then(function (res) {
            return preq.get({
                uri: URL('ro.wikipedia', 'mobile-site', 'monthly', '2017010100', '2017050100')
            });
        }).then(function (res) {
            var items = res.body.items;
            assert.deepEqual(items.length, 3);
            data.forEach(function (elem, idx) {
                assert.deepEqual(items[idx].project, 'ro.wikipedia');
                assert.deepEqual(items[idx]['access-site'], 'mobile-site');
                assert.deepEqual(items[idx].granularity, 'monthly');
                assert.deepEqual(items[idx].timestamp, elem[0]);
                assert.deepEqual(items[idx].count, elem[1]);
            });
        });
    });

    it('should return 404 when range has no data', function() {
        return assert.fails(
            preq.get({
                uri: URL('ar.wikipedia', 'all-sites', 'daily', '2017010100', '2017013100')
            }),
            function(res) {
                assert.deepEqual(res.status, 404);
            }
        );
    });

    it('should return 404 when project is invalid', function() {
        return assert.fails(
            preq.get({
                uri: URL('invalid-project', 'all-sites', 'daily', '2017010100', '2017013100')
            }),
            function(res) {
                assert.deepEqual(res.status, 404);
            }
        );
    });

    it('should return 400 when access site is invalid', function() {
        return assert.fails(
            preq.get({
                uri: URL('ar.wikipedia', 'invalid-access-site', 'daily', '2017010100', '2017013100')
            }),
            function(res) {
                assert.deepEqual(res.status, 400);
            }
        );
    });

    it('should return 400 when granularity is invalid', function() {
        return assert.fails(
            preq.get({
                uri: URL('ar.wikipedia', 'all-sites', 'invalid-granularity', '2017010100', '2017013100')
            }),
            function(res) {
                assert.deepEqual(res.status, 400);
            }
        );
    });

    it('should return 400 when start timestamp is invalid', function() {
        return assert.fails(
            preq.get({
                uri: URL('ar.wikipedia', 'all-sites', 'daily', 'invalid-timestamp', '2017013100')
            }),
            function(res) {
                assert.deepEqual(res.status, 400);
            }
        );
    });

    it('should return 400 when end timestamp is invalid', function() {
        return assert.fails(
            preq.get({
                uri: URL('ar.wikipedia', 'all-sites', 'daily', '2017010100', 'invalid-timestamp')
            }),
            function(res) {
                assert.deepEqual(res.status, 400);
            }
        );
    });

    it('should return 400 when end timestamp is smaller than start timestamp', function() {
        return assert.fails(
            preq.get({
                uri: URL('ar.wikipedia', 'all-sites', 'daily', '2017010200', '2017010100')
            }),
            function(res) {
                assert.deepEqual(res.status, 400);
            }
        );
    });
});
