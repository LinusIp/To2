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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#2563eb"));

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
