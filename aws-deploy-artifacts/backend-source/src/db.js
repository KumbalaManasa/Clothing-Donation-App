const knex = require('knex');
const knexConfig = require('../knexfile');

// NODE_ENV selects which knexfile.js environment to connect to — 'test' when
// run via scripts/run-tests.js (task 12.3), 'development' (the default)
// otherwise. This is the only place that decision is made; every route/service
// just requires this module.
const environment = process.env.NODE_ENV || 'development';

module.exports = knex(knexConfig[environment]);
