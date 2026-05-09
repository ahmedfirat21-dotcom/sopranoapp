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

// ★ v108.1: Metro file watcher gradle build klasörlerinde race condition yaşıyor
//   (node_modules/<pkg>/android/build/... klasörleri build sırasında oluşup siliniyor).
//   Bu klasörleri izleme listesinden çıkar → ENOENT watch hatasını önler.
const exclusionList = require('metro-config/src/defaults/exclusionList');
config.resolver.blockList = exclusionList([
  /.*\/android\/build\/.*/,
  /.*\/android\/\.cxx\/.*/,
  /.*\/ios\/build\/.*/,
  /.*\/ios\/Pods\/.*/,
  /.*\/\.gradle\/.*/,
]);

module.exports = config;
