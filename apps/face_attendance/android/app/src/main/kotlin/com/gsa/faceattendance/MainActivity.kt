package com.gsa.faceattendance

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val store = Store(applicationContext)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gsa/face").setMethodCallHandler(Bridge(this, store))
    }
}
