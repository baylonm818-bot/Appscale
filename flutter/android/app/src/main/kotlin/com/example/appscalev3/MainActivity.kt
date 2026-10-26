package com.example.appscalev3

import android.content.ContentValues
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.example.appscale/downloads"
    private var pendingResult: MethodChannel.Result? = null
    private var pendingSourcePath: String? = null
    private var pendingTargetName: String? = null
    private var pendingMimeType: String? = null
    private val STORAGE_PERMISSION_CODE = 1001

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "saveToPublicDownloads" -> {
                    val sourcePath = call.argument<String>("sourcePath")
                    val targetName = call.argument<String>("targetName")
                    val mimeType = call.argument<String>("mimeType") ?: "application/octet-stream"

                    if (sourcePath == null || targetName == null) {
                        result.error("INVALID_ARGS", "sourcePath and targetName are required", null)
                        return@setMethodCallHandler
                    }

                    val sourceFile = File(sourcePath)
                    if (!sourceFile.exists()) {
                        result.error("FILE_NOT_FOUND", "Source file does not exist", null)
                        return@setMethodCallHandler
                    }

                    // Android 10+ (API 29+): MediaStore (no storage permissions needed)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        try {
                            val savedPath = saveWithMediaStore(sourceFile, targetName, mimeType)
                            result.success(savedPath)
                        } catch (e: Exception) {
                            result.error("SAVE_FAILED", e.localizedMessage, null)
                        }
                    } else {
                        // Android 9 and below: require WRITE_EXTERNAL_STORAGE permission
                        val hasPermission = ContextCompat.checkSelfPermission(
                            this,
                            android.Manifest.permission.WRITE_EXTERNAL_STORAGE
                        ) == PackageManager.PERMISSION_GRANTED

                        if (hasPermission) {
                            try {
                                val savedPath = saveDirectlyToDownloads(sourceFile, targetName)
                                result.success(savedPath)
                            } catch (e: Exception) {
                                result.error("SAVE_FAILED", e.localizedMessage, null)
                            }
                        } else {
                            // Request permission
                            pendingResult = result
                            pendingSourcePath = sourcePath
                            pendingTargetName = targetName
                            pendingMimeType = mimeType
                            ActivityCompat.requestPermissions(
                                this,
                                arrayOf(android.Manifest.permission.WRITE_EXTERNAL_STORAGE),
                                STORAGE_PERMISSION_CODE
                            )
                        }
                    }
                }
                "showPhoneNotification" -> {
                    val title = call.argument<String>("title") ?: "AppScale Notification"
                    val message = call.argument<String>("message") ?: ""
                    val notificationId = (call.argument<Int>("id") ?: System.currentTimeMillis().toInt())

                    try {
                        showSystemNotification(notificationId, title, message)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("NOTIFICATION_ERROR", e.localizedMessage, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun showSystemNotification(id: Int, title: String, message: String) {
        val channelId = "appscale_channel"
        val notificationManager = getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = android.app.NotificationChannel(
                channelId,
                "AppScale Alerts & Reminders",
                android.app.NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for program schedules, downloads, and alerts"
                enableLights(true)
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = android.app.PendingIntent.getActivity(
            this,
            0,
            intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            } else {
                android.app.PendingIntent.FLAG_UPDATE_CURRENT
            }
        )

        val builder = androidx.core.app.NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(androidx.core.app.NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                notificationManager.notify(id, builder.build())
            } else {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                    1002
                )
            }
        } else {
            notificationManager.notify(id, builder.build())
        }
    }

    private fun saveWithMediaStore(sourceFile: File, targetName: String, mimeType: String): String {
        val resolver = applicationContext.contentResolver

        // Split name & extension
        val dotIndex = targetName.lastIndexOf('.')
        val baseName = if (dotIndex > 0) targetName.substring(0, dotIndex) else targetName
        val ext = if (dotIndex > 0) targetName.substring(dotIndex) else ""

        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, targetName)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }

        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw Exception("Failed to create MediaStore entry for Downloads")

        try {
            resolver.openOutputStream(uri)?.use { outStream ->
                FileInputStream(sourceFile).use { inStream ->
                    inStream.copyTo(outStream)
                }
            } ?: throw Exception("Failed to open output stream for Downloads URI")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear()
                values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            }

            return targetName
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e
        }
    }

    private fun saveDirectlyToDownloads(sourceFile: File, targetName: String): String {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }

        // Split name & extension for deduplication
        val dotIndex = targetName.lastIndexOf('.')
        val baseName = if (dotIndex > 0) targetName.substring(0, dotIndex) else targetName
        val ext = if (dotIndex > 0) targetName.substring(dotIndex) else ""

        var candidateFile = File(downloadsDir, targetName)
        var counter = 1
        while (candidateFile.exists()) {
            candidateFile = File(downloadsDir, "${baseName}_$counter$ext")
            counter++
        }

        FileInputStream(sourceFile).use { inStream ->
            FileOutputStream(candidateFile).use { outStream ->
                inStream.copyTo(outStream)
            }
        }

        if (!candidateFile.exists() || candidateFile.length() <= 0L) {
            throw Exception("Failed to write to public Downloads directory")
        }

        return candidateFile.name
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == STORAGE_PERMISSION_CODE) {
            val res = pendingResult
            val sPath = pendingSourcePath
            val tName = pendingTargetName
            pendingResult = null
            pendingSourcePath = null
            pendingTargetName = null
            pendingMimeType = null

            if (res != null) {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    if (sPath != null && tName != null) {
                        try {
                            val saved = saveDirectlyToDownloads(File(sPath), tName)
                            res.success(saved)
                        } catch (e: Exception) {
                            res.error("SAVE_FAILED", e.localizedMessage, null)
                        }
                    } else {
                        res.error("INVALID_STATE", "Pending request arguments lost", null)
                    }
                } else {
                    res.error("PERMISSION_DENIED", "Storage permission was denied", null)
                }
            }
        }
    }
}
