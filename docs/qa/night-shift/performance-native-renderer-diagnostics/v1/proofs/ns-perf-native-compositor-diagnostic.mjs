import { mkdir, writeFile } from 'node:fs/promises';
import { CHECKS } from '/workspace/tmu-course-guides/tools/qa/checks.mjs';
import { instrument } from '/workspace/tmu-course-guides/tools/qa/instrument.mjs';
import {
  inspectBrowserEnvironment,
  resolveLaunchOptions,
  resolvePlaywright,
  runHarness
} from '/workspace/tmu-course-guides/tools/qa/runtime.mjs';

const directory = '/tmp/ns-perf-native-compositor-diagnostic';
const argv = ['routes', '--base', '/'];
const env = {
  ...process.env,
  PLAYWRIGHT_PATH: '/tmp/ns-perf-ci-driver/node_modules/playwright',
  PLAYWRIGHT_BROWSERS_PATH: '/tmp/ns-perf-ci-browsers',
  QA_GPU: '0'
};
delete env.QA_CHROMIUM_PATH;
process.env.PLAYWRIGHT_BROWSERS_PATH = env.PLAYWRIGHT_BROWSERS_PATH;
// This is the existing optional navigation observer used by the ordinary run.
process.env.QA_NAV_DIAGNOSTICS = '1';

function launchConfig(playwright, options) {
  const launch = resolveLaunchOptions(playwright, options);
  launch.options.args.push('--disable-gpu-compositing');
  return launch;
}

async function inspectNativeEnvironment(browser, options) {
  const diagnostics = await inspectBrowserEnvironment(browser, options);
  const session = await browser.newBrowserCDPSession();
  try {
    const [commandLine, systemInfo] = await Promise.all([
      session.send('Browser.getBrowserCommandLine'),
      session.send('SystemInfo.getInfo')
    ]);
    return {
      ...diagnostics,
      chromiumCommandLine: commandLine.arguments,
      nativeGpu: {
        devices: systemInfo.gpu.devices,
        featureStatus: systemInfo.gpu.featureStatus,
        auxAttributes: systemInfo.gpu.auxAttributes
      }
    };
  } finally {
    await session.detach();
  }
}

await mkdir(directory);
const { playwright, modulePath } = resolvePlaywright({ env });
const launch = launchConfig(playwright, { env, gpu: false });
await writeFile(directory + '/resolved-config.json', JSON.stringify({
  argv,
  playwrightPath: modulePath,
  executableSource: launch.executableSource,
  launchOptions: launch.options,
  addedLaunchArguments: ['--disable-gpu-compositing'],
  navigationDiagnostics: true,
  limits: { nativeGotoMs: 10000, physicalChromiumClickMs: 30000 }
}, null, 2) + '\n');

const result = await runHarness({
  argv,
  env,
  checks: CHECKS,
  instrument,
  reportsRoot: directory + '/reports',
  launchConfig,
  inspectBrowser: inspectNativeEnvironment
});
process.exitCode = result.exitCode;
