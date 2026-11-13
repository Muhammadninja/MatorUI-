module.exports = {
  apps: [{
    name: 'mator-vehicle-images-staging',
    script: 'scripts/vehicle-image-server.mjs',
    interpreter: 'node',
    cwd: '/opt/mator/vehicle-image-pipeline-staging',
    uid: 'mator-vehicle-images-staging',
    gid: 'mator-vehicle-images-staging',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    kill_timeout: 200000,
    env: {
      NODE_ENV: 'production',
      VEHICLE_IMAGE_ENV_FILE: '/etc/mator/vehicle-images-staging.env',
    },
  }],
};
