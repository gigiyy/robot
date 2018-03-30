/**
 * Robot name updater for UiPath Orchestrator.
 * require(uipath-orchestrator, csv-parse, config, log4js)
 *   -to install dependencies
 *     npm install
 *
 *   -orchestrator config in file: orchestrator.json
 *   -target robot info etc configured through command line.
 *
 * Guixin Zhu 2018/03/26 v1.0.1
 */

'use strict';

// 3rd party
var config = require('config');

// local
var updater = require('./lib/updater');

updater.run(config);
