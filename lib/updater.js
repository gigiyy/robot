'use strict';

// native
var util = require('util');

// 3rd party
var log4js = require('log4js');
var async = require('async');

// local
var orchestratorHelper = require('./orchestratorHelper');
var csvHelper = require('./csvHelper');

var logger = log4js.getLogger();

/**
 * @param {number} unitId
 * @param {RobotDefinition} robotDefinition
 * @param {RobotEntry} robotEntry
 * @param {function(Error=)} callback
 */
function updateRobotName(unitId, robotDefinition, robotEntry, callback) {
    async.waterfall([
        function (next) {
            orchestratorHelper.setRobotName(
                unitId,
                robotDefinition,
                robotEntry.newName,
                next
            );
        },
        function (next) {
            if (robotDefinition.Name !== robotEntry.newName) {
                next(new Error('Unexpected robot name mismatch: ' + robotDefinition.Name + ' / ' + robotEntry.newName));
                return;
            }
            next();
        }
    ], callback);
}

function robotEntryHandlerFactory(dryRun) {
    return function (robotEntry, callback) {
        /** @type {number} */
        var organizationUnitId;

        async.waterfall([
            function (next) {
                orchestratorHelper.getOrganizationUnitByName(robotEntry.unit, next);
            },
            /**
             * @param {number} unitId
             * @param next
             */
            function (unitId, next) {
                organizationUnitId = unitId;
                orchestratorHelper.getRobotInfo(
                    unitId,
                    robotEntry.userName,
                    robotEntry.machine,
                    next
                );
            },
            /**
             * @param {RobotDefinition} robotDefinition
             * @param next
             */
            function (robotDefinition, next) {
                if (robotDefinition.Name === robotEntry.newName) {
                    logger.info("Robot name already up-to-date: " + robotEntry.newName);
                    next();
                    return;
                }
                if (dryRun) {
                    logger.info("Dry-run: skipping rename: " + robotEntry.newName);
                    next();
                    return;
                }
                updateRobotName(organizationUnitId, robotDefinition, robotEntry, next);
            }
        ], function (err) {
            if (err) {
                logger.error('Failed handling robot: ' +
                        robotEntry.unit + ' ' +
                        robotEntry.machine + '\\' + robotEntry.userName +
                        ' (' + robotEntry.newName + ')');
            }
            callback(err);
        });
    };
}

/** @param {RobotUpdaterConfiguration} config */
module.exports.run = function (config) {
    /** @type {boolean} */
    var dryRun = true;

    log4js.configure(config.log);
    orchestratorHelper.setup(config.orchestrator);
    if (config.prod === false) { // be extra safe
        dryRun = false;
    }

    logger.info('Updater configuration: ' + util.inspect(config.orchestrator));

    async.waterfall([
        function (next) {
            var csv = config.csv;
            csvHelper.read(csv.file, csv.from, csv.count, next);
        },
        /**
         * @param {Array.<RobotEntry>} robotEntries
         * @param {function()} next
         */
        function (robotEntries, next) {
            async.forEachOf(robotEntries, robotEntryHandlerFactory(dryRun), next);
        }
    ], function (err) {
        if (err) {
            logger.error(err.message);
        }
        logger.info('Done');
    });
};

/**
 * @typedef {Object} RobotUpdaterConfiguration
 * @property {OrchestratorHelperConfiguration} orchestrator
 * @property {Configuration} log
 * @property {{file: string, from: number, count: number|string}} csv
 * @property {boolean} prod
 */
