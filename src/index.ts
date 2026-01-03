/**
 * Obsidian Decision Engine - Server Entry Point
 * 
 * Starts the HTTP server and handles graceful shutdown.
 * 
 * @module index
 */

import 'dotenv/config';
import { buildApp } from './app.js';
import { ENGINE_VERSION } from './config/constants.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// =============================================================================
// SERVER START
// =============================================================================

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██████╗ ██████╗ ███████╗██╗██████╗ ██╗ █████╗ ███╗   ██╗   ║
║  ██╔═══██╗██╔══██╗██╔════╝██║██╔══██╗██║██╔══██╗████╗  ██║   ║
║  ██║   ██║██████╔╝███████╗██║██║  ██║██║███████║██╔██╗ ██║   ║
║  ██║   ██║██╔══██╗╚════██║██║██║  ██║██║██╔══██║██║╚██╗██║   ║
║  ╚██████╔╝██████╔╝███████║██║██████╔╝██║██║  ██║██║ ╚████║   ║
║   ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ║
║                                                               ║
║   Decision Engine v${ENGINE_VERSION}                                      ║
║   B2B AI Financial Decision Infrastructure                    ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   🚀 Server running at http://${HOST}:${PORT}                      ║
║   📚 API Documentation: http://${HOST}:${PORT}/docs                ║
║   💚 Health Check: http://${HOST}:${PORT}/health                   ║
║                                                               ║
║   Endpoints:                                                  ║
║   • POST /api/v1/affordability  - Purchase decisions          ║
║   • POST /api/v1/debt/payoff-plan - Debt optimization         ║
║   • POST /api/v1/next-action    - Financial advice            ║
║   • POST /api/v1/health-score   - Financial health grade      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // ==========================================================================
  // GRACEFUL SHUTDOWN
  // ==========================================================================

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    try {
      await app.close();
      console.log('Server closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the server
start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
