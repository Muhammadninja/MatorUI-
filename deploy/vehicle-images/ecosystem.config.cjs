module.exports = {
  apps: [{
    name: 'mator-vehicle-images',
    script: 'scripts/vehicle-image-server.mjs',
    interpreter: 'node',
    cwd: process.env.VEHICLE_IMAGE_APP_DIR || '/opt/mator/vehicle-image-pipeline',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    kill_timeout: 200000,
    env: {
      NODE_ENV: 'production',
      VEHICLE_IMAGE_ENV_FILE: '/etc/mator/vehicle-images.env',
    },
  }],
};
