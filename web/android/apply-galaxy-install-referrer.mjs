import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const projectRoot = resolve(process.argv[2] || '.');
const gradlePath = join(projectRoot, 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');

function addToGradleBlock(source, blockName, entry) {
  if (source.includes(entry)) return source;
  const block = new RegExp(`(${blockName}\\s*\\{)([\\s\\S]*?)(\\n\\})`);
  if (!block.test(source)) throw new Error(`Could not find the ${blockName} block in ${gradlePath}`);
  return source.replace(block, (_, open, contents, close) => `${open}${contents}\n    ${entry}${close}`);
}

gradle = addToGradleBlock(gradle, 'repositories', 'mavenCentral()');
gradle = addToGradleBlock(
  gradle,
  'dependencies',
  "implementation 'store.galaxy.samsung.installreferrer:samsung_galaxystore_install_referrer:4.0.0'",
);
const browserHelperDependency = /implementation 'com\.google\.androidbrowserhelper:androidbrowserhelper:[^']+'/;
if (!browserHelperDependency.test(gradle)) {
  throw new Error(`Could not find the Android Browser Helper dependency in ${gradlePath}`);
}
gradle = gradle.replace(
  browserHelperDependency,
  "implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.6.2'",
);
await writeFile(gradlePath, gradle);

async function findLauncherActivity(directory) {
  const matches = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...await findLauncherActivity(path));
    else if (entry.name === 'LauncherActivity.java') matches.push(path);
  }
  return matches;
}

const javaRoot = join(projectRoot, 'app', 'src', 'main', 'java');
const launcherFiles = await findLauncherActivity(javaRoot);
if (launcherFiles.length !== 1) {
  throw new Error(`Expected one LauncherActivity.java under ${javaRoot}, found ${launcherFiles.length}`);
}
const launcherPath = launcherFiles[0];
let launcher = await readFile(launcherPath, 'utf8');
launcher = launcher
  .replace('import android.os.RemoteException;\n', '')
  .replace('catch (RemoteException | RuntimeException error)', 'catch (RuntimeException error)');

const referrerCode = `    private static final String GALAXY_REFERRER_PREFS = "nepachat.galaxy_install_referrer";
    private static final String GALAXY_REFERRER_COMPLETE = "complete";
    private static final String GALAXY_REFERRER_LAST_ATTEMPT = "last_attempt_ms";
    private static final long GALAXY_REFERRER_RETRY_INTERVAL_MS = 24L * 60L * 60L * 1000L;

    private InstallReferrerClient galaxyReferrerClient;
    private boolean galaxyReferrerRequestStarted;

    private void connectGalaxyStoreInstallReferrer() {
        SharedPreferences preferences = getSharedPreferences(GALAXY_REFERRER_PREFS, MODE_PRIVATE);
        long lastAttempt = preferences.getLong(GALAXY_REFERRER_LAST_ATTEMPT, 0L);
        if (preferences.getBoolean(GALAXY_REFERRER_COMPLETE, false)
                || galaxyReferrerRequestStarted
                || System.currentTimeMillis() - lastAttempt < GALAXY_REFERRER_RETRY_INTERVAL_MS) {
            return;
        }

        galaxyReferrerRequestStarted = true;
        preferences.edit().putLong(GALAXY_REFERRER_LAST_ATTEMPT, System.currentTimeMillis()).apply();
        galaxyReferrerClient = InstallReferrerClient.newBuilder(this).build();
        galaxyReferrerClient.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                try {
                    switch (responseCode) {
                        case InstallReferrerClient.InstallReferrerResponse.OK:
                            try {
                                ReferrerDetails details = galaxyReferrerClient.getInstallReferrer();
                                preferences.edit()
                                        .putString("install_referrer", details.getInstallReferrer())
                                        .putLong("referrer_click_time_seconds", details.getReferrerClickTimestampSeconds())
                                        .putLong("install_begin_time_seconds", details.getInstallBeginTimestampSeconds())
                                        .putBoolean(GALAXY_REFERRER_COMPLETE, true)
                                        .apply();
                            } catch (RuntimeException error) {
                                Log.w("NepaChatReferrer", "Unable to read Galaxy Store install referrer.", error);
                            }
                            break;
                        case InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED:
                            preferences.edit().putBoolean(GALAXY_REFERRER_COMPLETE, true).apply();
                            Log.i("NepaChatReferrer", "Galaxy Store install referrer is not supported on this device.");
                            break;
                        case InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE:
                            Log.w("NepaChatReferrer", "Galaxy Store install referrer service is unavailable; retrying on a later launch.");
                            break;
                        case InstallReferrerClient.InstallReferrerResponse.DEVELOPER_ERROR:
                            preferences.edit().putBoolean(GALAXY_REFERRER_COMPLETE, true).apply();
                            Log.e("NepaChatReferrer", "Galaxy Store rejected the install referrer request due to an API usage error.");
                            break;
                        default:
                            Log.w("NepaChatReferrer", "Galaxy Store returned an unrecognized install referrer response: " + responseCode);
                            break;
                    }
                } finally {
                    endConnectGalaxy();
                }
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                endConnectGalaxy();
            }
        });
    }

    private void endConnectGalaxy() {
        if (galaxyReferrerClient != null) {
            galaxyReferrerClient.endConnection();
            galaxyReferrerClient = null;
        }
    }
`;

if (!launcher.includes('GALAXY_REFERRER_PREFS')) {
  const imports = [
    'android.content.SharedPreferences',
    'android.util.Log',
    'com.samsung.android.sdk.sinstallreferrer.api.InstallReferrerClient',
    'com.samsung.android.sdk.sinstallreferrer.api.InstallReferrerStateListener',
    'com.samsung.android.sdk.sinstallreferrer.api.ReferrerDetails',
  ];
  const packageDeclaration = /^(package [^\r\n]+;)/m;
  if (!packageDeclaration.test(launcher)) throw new Error(`Could not find package declaration in ${launcherPath}`);
  launcher = launcher.replace(packageDeclaration, `$1\n\n${imports.map(value => `import ${value};`).join('\n')}`);

  const classDeclaration = /(public class LauncherActivity\s+extends [^{]+\{\s*)/;
  if (!classDeclaration.test(launcher)) throw new Error(`Could not find LauncherActivity class declaration in ${launcherPath}`);
  launcher = launcher.replace(classDeclaration, `$1${referrerCode}\n`);

  const onCreateCall = '        super.onCreate(savedInstanceState);';
  if (!launcher.includes(onCreateCall)) throw new Error(`Could not find onCreate insertion point in ${launcherPath}`);
  launcher = launcher.replace(onCreateCall, `${onCreateCall}\n        connectGalaxyStoreInstallReferrer();`);
  await writeFile(launcherPath, launcher);
}
