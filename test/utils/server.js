'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, after, afterEach */

const ServiceRunner = require('service-runner');
const logStream = require('./logStream');
const fs        = require('fs');
const assert    = require('./assert');
const yaml      = require('js-yaml');

class TestRunner {
    constructor () {
        this.config = {
            aqsURL: TestRunner.AQS_URL,
            logStream: logStream(),
            runnerConfig: this.loadConfig(__dirname + '/../../config.test.yaml')
        };
        this.config.runnerConfig.num_workers = 0;
        this.config.runnerConfig.logging = {
            name: 'restbase-tests',
            level: 'trace',
            stream: this.config.logStream
        };
        this.runner = new ServiceRunner();
    }

    start () {
        console.log('Starting AQS in '
                + (this.config.runnerConfig.offline ? 'OFFLINE' : 'ONLINE') + ' mode');
        return this.runner.start(this.config.runnerConfig)
            .then((servers) => {
                const server = servers[0][0];
                this.runner.server = server;
                return true;
            });
    }

    stop () {
        this.runner.stop();
    }

    loadConfig (path) {
        let confString = fs.readFileSync(path).toString();
        const backendImpl = process.env.RB_TEST_BACKEND;
        if (backendImpl) {
            if (backendImpl !== 'cassandra' && backendImpl !== 'sqlite') {
                throw new Error('Invalid RB_TEST_BACKEND env variable value. Allowed values: "cassandra", "sqlite"');
            }
            if (backendImpl === 'sqlite') {
                confString = confString.replace(/backend: cassandra/, "backend: sqlite");
            }
        }
        return yaml.safeLoad(confString);
    }
}

const hostPort  = 'http://localhost:7231';
TestRunner.AQS_URL  = hostPort + '/analytics.wikimedia.org/v1';

module.exports = TestRunner;
