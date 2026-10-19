package com.musicpp.app;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 后台播放辅助：WebView 里的 <audio> 负责解码，这里用前台服务 + 唤醒锁
 * 保证 App 切后台 / 锁屏时进程不被回收，音乐可以继续播放。
 */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        // 服务已在运行就直接返回：重复 startForegroundService 既无意义，
        // 在 Android 12+ 的后台场景还会被系统直接拒绝
        if (PlaybackService.isRunning()) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(getContext(), PlaybackService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            // Android 12+ 后台禁止启动前台服务（ForegroundServiceStartNotAllowedException）。
            // 该类在低版本 SDK 上不存在，直接 catch 具体类型会 NoClassDefFoundError，故按类名判断
            if (e.getClass().getName().contains("ForegroundServiceStartNotAllowedException")) {
                call.reject("系统限制后台启动前台服务，请回到 App 内继续播放", e);
                return;
            }
            call.reject("无法启动后台播放服务", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            if (PlaybackService.isRunning()) {
                getContext().stopService(new Intent(getContext(), PlaybackService.class));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("无法停止后台播放服务", e);
        }
    }
}
