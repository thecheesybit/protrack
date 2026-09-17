package com.protrack.app.updater;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppUpdatePlugin")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            call.reject("Download URL is required");
            return;
        }

        new Thread(() -> {
            try {
                Context context = getContext();
                File cacheDir = context.getExternalCacheDir();
                if (cacheDir == null) {
                    cacheDir = context.getCacheDir();
                }

                File apkFile = new File(cacheDir, "protrack-update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                URL url = new URL(downloadUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);
                connection.connect();

                int status = connection.getResponseCode();
                if (status == HttpURLConnection.HTTP_MOVED_TEMP ||
                    status == HttpURLConnection.HTTP_MOVED_PERM ||
                    status == 307 ||
                    status == 308) {
                    String newUrl = connection.getHeaderField("Location");
                    connection = (HttpURLConnection) new URL(newUrl).openConnection();
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.connect();
                }

                try (InputStream in = connection.getInputStream();
                     FileOutputStream out = new FileOutputStream(apkFile)) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                    }
                    out.flush();
                }

                Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
                );

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);

                JSObject ret = new JSObject();
                ret.put("status", "installer_launched");
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Update download or install failed: " + e.getMessage(), e);
            }
        }).start();
    }
}
