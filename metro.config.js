// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// es-abstract paketinin "exports" alanı Metro'nun resolver'ını bozuyor.
// Bu custom resolver, es-abstract alt modüllerini doğrudan dosya yoluna çözümler.
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // es-abstract/2023/XXX gibi yolları doğrudan dosyaya yönlendir
  if (moduleName.startsWith('es-abstract/')) {
    const filePath = path.join(
      __dirname,
      'node_modules',
      moduleName + '.js'
    );
    return {
      filePath,
      type: 'sourceFile',
    };
  }

  // Diğer tüm modüller normal çözümlensin
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.assetExts.push('glb', 'gltf');

module.exports = config;
