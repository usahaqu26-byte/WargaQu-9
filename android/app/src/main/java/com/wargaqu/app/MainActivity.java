package com.wargaqu.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private View statusBarBackdrop;
    private View navBarBackdrop;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySafeAreaSystemBars();
    }

    @SuppressWarnings("deprecation")
    private void applySafeAreaSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        final int emeraldTopColor = Color.parseColor("#047857");
        final boolean supportsLightNavBar = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
        final int navBgColor = supportsLightNavBar
                ? Color.parseColor("#F0FDF4")
                : Color.parseColor("#0F172A");

        if (Build.VERSION.SDK_INT < 35) {
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            if (supportsLightNavBar) {
                controller.setAppearanceLightNavigationBars(true);
            }
        }

        final ViewGroup contentView = findViewById(android.R.id.content);
        if (contentView == null) {
            return;
        }

        contentView.setBackgroundColor(navBgColor);

        if (statusBarBackdrop == null) {
            statusBarBackdrop = new View(this);
            statusBarBackdrop.setBackgroundColor(emeraldTopColor);
            FrameLayout.LayoutParams topLp = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    0,
                    Gravity.TOP
            );
            contentView.addView(statusBarBackdrop, 0, topLp);
        }

        if (navBarBackdrop == null) {
            navBarBackdrop = new View(this);
            navBarBackdrop.setBackgroundColor(navBgColor);
            FrameLayout.LayoutParams bottomLp = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    0,
                    Gravity.BOTTOM
            );
            contentView.addView(navBarBackdrop, 1, bottomLp);
        }

        ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
            Insets sysBars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());

            int bottomMargin = Math.max(sysBars.bottom, ime.bottom);

            if (statusBarBackdrop != null) {
                ViewGroup.LayoutParams lp = statusBarBackdrop.getLayoutParams();
                if (lp.height != sysBars.top) {
                    lp.height = sysBars.top;
                    statusBarBackdrop.setLayoutParams(lp);
                }
            }

            if (navBarBackdrop != null) {
                ViewGroup.LayoutParams lp = navBarBackdrop.getLayoutParams();
                if (lp.height != sysBars.bottom) {
                    lp.height = sysBars.bottom;
                    navBarBackdrop.setLayoutParams(lp);
                }
            }

            for (int i = 0; i < contentView.getChildCount(); i++) {
                View child = contentView.getChildAt(i);
                if (child == statusBarBackdrop || child == navBarBackdrop) {
                    continue;
                }
                ViewGroup.LayoutParams rawLp = child.getLayoutParams();
                if (rawLp instanceof ViewGroup.MarginLayoutParams) {
                    ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) rawLp;
                    if (mlp.leftMargin != sysBars.left
                            || mlp.topMargin != sysBars.top
                            || mlp.rightMargin != sysBars.right
                            || mlp.bottomMargin != bottomMargin) {
                        mlp.setMargins(sysBars.left, sysBars.top, sysBars.right, bottomMargin);
                        child.setLayoutParams(mlp);
                    }
                }
            }

            return WindowInsetsCompat.CONSUMED;
        });

        ViewCompat.requestApplyInsets(contentView);
    }
}
