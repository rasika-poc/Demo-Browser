// Ad-hoc sign the packaged app. Without a valid signature, macOS reports a
// downloaded unsigned Electron app as "damaged" instead of just unverified.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function adhocSign({ appOutDir, packager, electronPlatformName }) {
  if (electronPlatformName !== 'darwin') return;
  const app = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
