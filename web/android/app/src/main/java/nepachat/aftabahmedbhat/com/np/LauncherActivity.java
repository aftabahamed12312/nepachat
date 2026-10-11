/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package nepachat.aftabahmedbhat.com.np;

import android.content.SharedPreferences;
import android.os.RemoteException;
import android.util.Log;
import com.samsung.android.sdk.sinstallreferrer.api.InstallReferrerClient;
import com.samsung.android.sdk.sinstallreferrer.api.InstallReferrerStateListener;
import com.samsung.android.sdk.sinstallreferrer.api.ReferrerDetails;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    

    

        private static final String GALAXY_REFERRER_PREFS = "nepachat.galaxy_install_referrer";
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
                            } catch (RemoteException | RuntimeException error) {
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

@Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        connectGalaxyStoreInstallReferrer();
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        

        return uri;
    }
}
