# Analytics Query Service

 REST API for wikimedia projects pageviews data.

## Installation

Make sure that you have node 4.4+:

### Linux (Ubuntu)
```sh
sudo apt-get install nodejs nodejs-legacy nodejs-dev npm
```
### Mac OS X

You can directly install node from packages downloads at: https://nodejs.org/en/download/

If you use brew be careful as it might be installing "too-new-of-a-version"
You can run:
```sh
brew info node
```
Brew formulas for node are available at: https://github.com/Homebrew/homebrew-core/blob/master/Formula/node.rb

From the *query-service* project directory, install the Node dependencies:

```sh
npm install
```

Start Query Service:

```sh
node server
```

The defaults without a config file should work for a local Cassandra
installation with the default passwords. To customize Query Service's behavior,
copy the example config to its default location:

```sh
cp config.example.yaml config.yaml
```

You can also pass in the path to another file with the `-c` commandline option
to `server.js`. If you're running a single Cassandra instance (e.g. a local
development environment), set `defaultConsistency` to `one` in
`config.yaml`.

### Testing

To run all the tests from a clean slate, first make sure Cassandra is running locally, then fire up the tests with npm:

```
npm test
```

### Coverage

To check the test coverage, use npm, then browse the report:

```
npm run-script coverage
```

The coverage report can now be found in *&lt;project&gt;/coverage/lcov-report/index.html*.

