const path = require('node:path');
const { notarize } = require('@electron/notarize');

module.exports = async function notarizeApp(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID must be set.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  await notarize({
    appBundleId: 'com.brisonharvey.classroomengine',
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
};
