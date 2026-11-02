const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// The isolated backend has its own package tree and private runtime files.
// Metro must never index or resolve any of it as application source.
const localRuntime = path.join(__dirname, '.local').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const existingBlocks = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlocks) ? existingBlocks : existingBlocks ? [existingBlocks] : []),
  new RegExp(`${localRuntime}[/\\\\].*`),
];

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
