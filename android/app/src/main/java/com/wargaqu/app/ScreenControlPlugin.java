package com.wargaqu.app;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenControl")
public class ScreenControlPlugin extends Plugin {

    @PluginMethod
    public void setOrientation(PluginCall call) {
        final String mode = call.getString("mode", "auto");
        final boolean immersive = call.getBoolean("immersive", false);
        final Activity activity = getActivity();

        if (activity == null) {
            call.reject("Activity tidak tersedia");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                if ("landscape".equalsIgnoreCase(mode)) {
                    activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                } else if ("portrait".equalsIgnoreCase(mode)) {
                    activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                } else {
                    activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                }

                WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
                if (controller != null) {
                    if (immersive) {
                        controller.setSystemBarsBehavior(
                                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                        );
                        controller.hide(WindowInsetsCompat.Type.systemBars());
                    } else {
                        controller.show(WindowInsetsCompat.Type.systemBars());
                    }
                }

                if (activity.findViewById(android.R.id.content) != null) {
                    ViewCompat.requestApplyInsets(activity.findViewById(android.R.id.content));
                }

                JSObject res = new JSObject();
                res.put("supported", true);
                res.put("mode", mode);
                res.put("immersive", immersive);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Gagal mengatur orientasi layar: " + e.getMessage());
            }
        });
    }
}
