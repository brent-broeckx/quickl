import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.quickl.app',
  productName: 'Quickl',
  files: [
    'out/main/**/*',
    'out/preload/**/*',
    'out/renderer/**/*'
  ],
  directories: {
    buildResources: 'assets'
  },
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.developer-tools',
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },
  win: {
    target: ['nsis', 'portable'],
    certificateFile: undefined,
    certificatePassword: undefined,
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },
  linux: {
    target: ['AppImage', 'rpm', 'deb'],
    category: 'Development',
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  }
}

export default config
