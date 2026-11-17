package uz.to2.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * To2 Android shell (Capacitor 6) around the production site.
 * - "Savol berish" (mic): the page's getUserMedia() asks the WebView for the microphone; we ask Android
 *   for RECORD_AUDIO at runtime on that first request, then grant the WebView's request.
 * - Tutor voice plays without a tap (media playback doesn't require a user gesture).
 * - Back button = in-app history back; it only leaves the app from the home screen.
 * - Blue status bar (#2563eb); portrait only (AndroidManifest).
 */
public class MainActivity extends BridgeActivity {
    private static final int REQ_MIC = 4711;
    private PermissionRequest pendingMic;

    /** Below this Android System WebView major version the site's CSS / 3D may not work well. */
    private static final int MIN_WEBVIEW_MAJOR = 100;

    /** Installed WebView major version (e.g. 83), or -1 if unknown. */
    private int webViewMajor() {
        try {
            if (android.os.Build.VERSION.SDK_INT < 26) return -1;
            android.content.pm.PackageInfo pi = WebView.getCurrentWebViewPackage();
            if (pi == null || pi.versionName == null) return -1;
            return Integer.parseInt(pi.versionName.split("\\.")[0]);
        } catch (Exception e) {
            return -1;
        }
    }

    /** Old WebView: a native screen asking to update it (Play Store), or continue anyway. */
    private void warnOldWebView(int major) {
        new android.app.AlertDialog.Builder(this)
            .setTitle("Iltimos, Android System WebView ni yangilang")
            .setMessage("To2 to'g'ri ishlashi uchun yangiroq versiya kerak (hozir: " + major + "). Yangilash bepul va bir daqiqa oladi.")
            .setCancelable(false)
            .setPositiveButton("Yangilash", (d, w) -> {
                String id = "com.google.android.webview";
                try {
                    startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("market://details?id=" + id)));
                } catch (Exception e) {
                    startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://play.google.com/store/apps/details?id=" + id)));
                }
            })
            .setNegativeButton("Baribir davom etish", (d, w) -> d.dismiss())
            .show();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#2563eb"));
        int wv = webViewMajor();
        if (wv > 0 && wv < MIN_WEBVIEW_MAJOR) warnOldWebView(wv);

        WebView web = getBridge().getWebView();
        WebSettings s = web.getSettings();
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                boolean wantsMic = false;
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
                }
                if (!wantsMic) {
                    super.onPermissionRequest(request);
                    return;
                }
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    runOnUiThread(() -> request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE }));
                } else {
                    // first mic press: ask Android, answer the WebView when the user decides
                    pendingMic = request;
                    ActivityCompat.requestPermissions(MainActivity.this, new String[] { Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS }, REQ_MIC);
                }
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView w = getBridge().getWebView();
                String url = w.getUrl() != null ? w.getUrl() : "";
                String path = url.replaceFirst("^https?://[^/]+", "");
                boolean atHome = path.isEmpty() || path.equals("/") || path.startsWith("/home");
                if (!atHome && w.canGoBack()) {
                    w.goBack();
                } else if (!atHome) {
                    w.loadUrl(url.replaceFirst("^(https?://[^/]+).*$", "$1/home"));
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed(); // leave the app
                }
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_MIC || pendingMic == null) return;
        final PermissionRequest req = pendingMic;
        pendingMic = null;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        runOnUiThread(() -> {
            if (granted) req.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            else req.deny(); // the page falls back to typing the question
        });
    }
}
