const healthService = require('../services/health');

class HealthController {
  // PUBLIC_INTERFACE
  /**
   * Health check endpoint controller.
   * Returns JSON with status, message, timestamp, and environment.
   */
  check(req, res) {
    const healthStatus = healthService.getStatus();
    return res.status(200).json(healthStatus);
  }
}

module.exports = new HealthController();
