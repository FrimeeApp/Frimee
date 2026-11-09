package com.frimee.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Frimee on screen: a call that arrives now rings in the app, not as a notification. */
    public static volatile boolean isInForeground = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        registerPlugin(AppSettingsPlugin.class);
        registerPlugin(CallNativePlugin.class);
        super.onCreate(savedInstanceState);
        // Android 15 ignores the navigation bar colour and draws a veil behind the buttons; without
        // the veil the window background shows, painted with the app's colour (AppSettings).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
        showOverLockScreenIfCall(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        showOverLockScreenIfCall(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        isInForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        isInForeground = false;
    }

    /** Opened from a call notification (fremee://call/…): show over the lock screen and light it up. */
    private void showOverLockScreenIfCall(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        if (data == null || !"fremee".equals(data.getScheme()) || !"call".equals(data.getHost())) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
    }

    /** The call is over: back to normal behind the lock screen. */
    public void releaseLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(false);
            setTurnScreenOn(false);
        }
    }
}
