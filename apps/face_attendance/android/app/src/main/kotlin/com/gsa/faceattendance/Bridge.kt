package com.gsa.faceattendance

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.Executors
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Platform channel "gsa/face". Everything that touches faces, keys or the offline queue happens here, on one
 * background thread (the SeetaFace engine is not thread safe). Flutter only receives small JSON results:
 * it never sees a face template, an encryption key or a raw image.
 */
class Bridge(private val activity: Activity, private val store: Store) : MethodChannel.MethodCallHandler {
    private val engine = FaceEngine(activity.applicationContext, store)
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val rnd = SecureRandom()

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        // window changes must run on the UI thread
        when (call.method) {
            "setBrightness" -> { val v = (call.argument<Double>("value") ?: -1.0).toFloat(); activity.window.attributes = activity.window.attributes.also { it.screenBrightness = v }; result.success(null); return }
            "keepScreenOn" -> { if (call.argument<Boolean>("on") == true) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); result.success(null); return }
            "engineProgress" -> { result.success(engine.progress.toString()); return } // must not wait behind a running model download
        }
        worker.execute {
            try {
                val r = handle(call)
                main.post { result.success(r) }
            } catch (e: Throwable) {
                main.post { result.error("native", e.message ?: e.javaClass.simpleName, e.javaClass.simpleName) }
            }
        }
    }

    private fun str(c: MethodCall, k: String): String = c.argument<String>(k) ?: throw IllegalArgumentException("missing $k")

    private fun handle(c: MethodCall): Any? = when (c.method) {
        // ---- engine ----
        "engineInit" -> { engine.init(); status().toString() }
        "engineStatus" -> status().toString()
        "scanBegin" -> { engine.scanBegin(); null }
        "scanFrame" -> engine.scanFrame(str(c, "path")).toString()
        "enrolBegin" -> { engine.enrolBegin(str(c, "studentId")); null }
        "enrolFrame" -> engine.enrolFrame(str(c, "path")).toString()
        "enrolCommit" -> engine.enrolCommit().toString()
        "enrolCancel" -> { engine.enrolCancel(); null }
        "deleteStudents" -> { engine.deleteStudents(JSONArray(str(c, "ids")).let { a -> (0 until a.length()).map { a.get(it).toString() } }); status().toString() }
        "eraseAllFaces" -> { engine.clearAll(); status().toString() }
        "getConfig" -> engine.cfg.toJson().toString()
        "setConfig" -> { engine.applyConfig(Cfg.from(JSONObject(str(c, "json")), engine.cfg)); engine.cfg.toJson().toString() }
        "setCalibrationLabel" -> { engine.setCalibrationLabel(c.argument<String>("label")); null }
        "calibrationCsv" -> engine.calibrationCsv()
        "clearCalibration" -> { engine.clearCalibration(); null }
        // ---- encrypted key/value ----
        "kvGet" -> store.kvGet(str(c, "key"))
        "kvPut" -> { store.kvPut(str(c, "key"), str(c, "value")); null }
        "kvDelete" -> { store.kvDelete(str(c, "key")); null }
        // ---- offline attendance queue ----
        "recordEvent" -> recordEvent(c).toString()
        "queuePending" -> store.pending(c.argument<Int>("limit") ?: 50).toString()
        "queueAck" -> { val a = JSONArray(str(c, "ids")); store.ack((0 until a.length()).map { a.getString(it) }.toSet()).toString() }
        "queueReject" -> { val j = JSONObject(str(c, "reasons")); store.reject(j.keys().asSequence().associateWith { j.getString(it) }); null }
        "queueCounts" -> store.counts().put("store_error", store.loadError ?: JSONObject.NULL).toString()
        "queueRejected" -> store.rejected().toString()
        "queueDiscard" -> { store.discard(str(c, "id")); null }
        // ---- admin PIN (verifies offline) ----
        "pinStatus" -> JSONObject().put("set", store.kvGet("pin_hash") != null).put("locked_seconds", lockedSeconds()).toString()
        "pinSet" -> { setPin(str(c, "pin")); null }
        "pinVerify" -> pinVerify(str(c, "pin")).toString()
        "pinClear" -> { listOf("pin_hash", "pin_salt", "pin_fail", "pin_lock_until").forEach { store.kvDelete(it) }; null }
        else -> throw IllegalArgumentException("unknown method ${c.method}")
    }

    private fun status() = JSONObject().put("ready", engine.ready).put("enrolled", JSONArray(engine.enrolledStudents()))

    /**
     * Queues one attendance event (encrypted on disk until the backend acknowledges it).
     * A repeat of the same student and type inside the cool-down is reported as "duplicate" and not stored.
     */
    private fun recordEvent(c: MethodCall): JSONObject {
        val sid = str(c, "studentId"); val type = str(c, "eventType"); val method = c.argument<String>("method") ?: "face"
        val cooldownMs = (c.argument<Int>("cooldownSeconds") ?: 600) * 1000L
        val now = System.currentTimeMillis()
        val key = "last_${sid}_$type"
        val last = store.kvGet(key)?.toLongOrNull()
        if (last != null && now - last < cooldownMs) return JSONObject().put("status", "duplicate").put("last_at", java.time.Instant.ofEpochMilli(last).toString())
        val ev = JSONObject().put("event_id", UUID.randomUUID().toString()).put("student_id", sid.toLong()).put("event_type", type).put("method", method)
            .put("occurred_at", java.time.Instant.ofEpochMilli(now).toString())
        c.argument<Double>("matchScore")?.let { ev.put("match_score", it) }
        c.argument<Double>("liveness")?.let { ev.put("liveness_score", it) }
        c.argument<String>("markedBy")?.let { ev.put("marked_by", it) }
        store.enqueue(ev)            // durable (fsync + atomic rename) before we tell the screen it worked
        store.kvPut(key, now.toString())
        return JSONObject().put("status", "recorded").put("event_id", ev.getString("event_id")).put("occurred_at", ev.getString("occurred_at"))
    }

    // ---- PIN: PBKDF2-HMAC-SHA256, 5 wrong tries lock it for 5 minutes ----
    private fun hashPin(pin: String, salt: ByteArray): String =
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(PBEKeySpec(pin.toCharArray(), salt, 120_000, 256)).encoded.joinToString("") { "%02x".format(it) }

    private fun setPin(pin: String) {
        require(pin.length in 4..12 && pin.all { it.isDigit() }) { "PIN must be 4 to 12 digits" }
        val salt = ByteArray(16).also { rnd.nextBytes(it) }
        store.kvPut("pin_salt", salt.joinToString("") { "%02x".format(it) })
        store.kvPut("pin_hash", hashPin(pin, salt))
        store.kvPut("pin_fail", "0")
    }

    private fun lockedSeconds(): Long = maxOf(0L, ((store.kvGet("pin_lock_until")?.toLongOrNull() ?: 0L) - System.currentTimeMillis()) / 1000)

    private fun pinVerify(pin: String): JSONObject {
        val locked = lockedSeconds()
        if (locked > 0) return JSONObject().put("ok", false).put("locked_seconds", locked)
        val hash = store.kvGet("pin_hash"); val saltHex = store.kvGet("pin_salt")
        if (hash == null || saltHex == null) return JSONObject().put("ok", false).put("not_set", true)
        val salt = saltHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        val ok = java.security.MessageDigest.isEqual(hashPin(pin, salt).toByteArray(), hash.toByteArray())
        if (ok) { store.kvPut("pin_fail", "0"); return JSONObject().put("ok", true) }
        val fails = (store.kvGet("pin_fail")?.toIntOrNull() ?: 0) + 1
        if (fails >= 5) { store.kvPut("pin_fail", "0"); store.kvPut("pin_lock_until", (System.currentTimeMillis() + 5 * 60_000).toString()) } else store.kvPut("pin_fail", fails.toString())
        return JSONObject().put("ok", false).put("locked_seconds", lockedSeconds()).put("tries_left", maxOf(0, 5 - fails))
    }
}
