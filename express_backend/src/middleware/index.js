'use strict';

const { authenticate } = require('./auth');

// This file centralizes middleware exports
module.exports = {
  authenticate,
};
