package com.frimee.app;

import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        registerPlugin(AppSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        // Android 15 ignores the navigation bar colour and draws a veil behind the buttons; without
        // the veil the window background shows, painted with the app's colour (AppSettings).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }
}
