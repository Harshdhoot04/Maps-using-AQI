// Configuration module for client-side usage
// This file exports configuration values that can be imported by other modules

// For development, you can set these values directly
// For production, these should be injected by a build process or loaded from a secure endpoint
const config = {
  OPENWEATHER_KEY: "cc89ee52f5cdf7cd8a3915cba042774f",
  OPENCAGE_KEY: "c8757ad0a33247e98b6faf04d8ed744f"
};

// Also make them available on window for backward compatibility
if (typeof window !== 'undefined') {
  window.OPENWEATHER_KEY = config.OPENWEATHER_KEY;
  window.OPENCAGE_KEY = config.OPENCAGE_KEY;
}

export default config;
