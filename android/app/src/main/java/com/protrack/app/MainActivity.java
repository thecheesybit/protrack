package com.protrack.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.protrack.app.updater.AppUpdatePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
