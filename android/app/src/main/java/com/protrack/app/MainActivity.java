package com.protrack.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.protrack.app.updater.AppUpdatePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);

        // Let muted, looping ambient videos (widget backgrounds, the AI orb, the
        // app-lock scene) autoplay without a user gesture. Android WebView defaults
        // to requiring one, which is why the tablet build showed static/blank video
        // tags. The JS side pairs this with autoplay on tablet (see AmbientVideo).
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
            }
        } catch (Exception ignored) {
            // Non-fatal: videos simply fall back to their static poster/gradient.
        }
    }
}
