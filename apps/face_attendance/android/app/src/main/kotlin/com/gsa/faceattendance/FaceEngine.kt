package com.gsa.faceattendance

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import com.ahmadarif.gdface.sdk.GdFaceDownloadProgressListener
import com.ahmadarif.gdface.sdk.GdFaceLicenseException
import com.ahmadarif.gdface.sdk.GdFaceModelProvider
import com.ahmadarif.gdface.sdk.GdFaceSDK
import com.seeta.sdk.FaceAntiSpoofing
import com.seeta.sdk.FaceDatabase
import com.seeta.sdk.FaceDetector
import com.seeta.sdk.FaceLandmarker
import com.seeta.sdk.SeetaDevice
import com.seeta.sdk.SeetaImageData
import com.seeta.sdk.SeetaModelSetting
import com.seeta.sdk.SeetaPointF
import com.seeta.sdk.SeetaRect
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/** Tunable decision thresholds. NOT calibrated yet: calibrate on the real phone (see TESTING.md). */
data class Cfg(
    val matchThreshold: Float = 0.65f,   // minimum similarity of the best student
    val minMargin: Float = 0.05f,        // best student must beat the next different student by this much
    val livenessReality: Float = 0.80f,  // SeetaFace "reality" threshold for FaceAntiSpoofing
    val hitsRequired: Int = 2,           // live, agreeing frames needed before attendance is recorded
    val minFacePx: Int = 140,            // smallest accepted face (shorter side, pixels, after downscale)
    val maxRollDeg: Double = 20.0,
    val maxYaw: Double = 0.30,           // |nose offset| / eye distance
    val minBright: Double = 50.0,
    val maxBright: Double = 215.0,
    val minSharp: Double = 40.0,         // variance of the Laplacian on a 128px face crop
    val enrolFrames: Int = 3,
) {
    fun toJson() = JSONObject().put("matchThreshold", matchThreshold.toDouble()).put("minMargin", minMargin.toDouble())
        .put("livenessReality", livenessReality.toDouble()).put("hitsRequired", hitsRequired).put("minFacePx", minFacePx)
        .put("maxRollDeg", maxRollDeg).put("maxYaw", maxYaw).put("minBright", minBright).put("maxBright", maxBright)
        .put("minSharp", minSharp).put("enrolFrames", enrolFrames)

    companion object {
        fun from(j: JSONObject, d: Cfg = Cfg()) = Cfg(
            j.optDouble("matchThreshold", d.matchThreshold.toDouble()).toFloat(), j.optDouble("minMargin", d.minMargin.toDouble()).toFloat(),
            j.optDouble("livenessReality", d.livenessReality.toDouble()).toFloat(), j.optInt("hitsRequired", d.hitsRequired),
            j.optInt("minFacePx", d.minFacePx), j.optDouble("maxRollDeg", d.maxRollDeg), j.optDouble("maxYaw", d.maxYaw),
            j.optDouble("minBright", d.minBright), j.optDouble("maxBright", d.maxBright), j.optDouble("minSharp", d.minSharp),
            j.optInt("enrolFrames", d.enrolFrames),
        )
    }
}

/**
 * Face engine for GSA Face Attendance. It uses the GdFace SDK's model download/verification
 * (GdFaceModelProvider) and the SeetaFace6 native classes directly, instead of GdFaceEngine, because
 * GdFaceEngine hard-codes its match threshold, returns only the single best hit (no ambiguity check),
 * applies no image-quality gate, and writes its face database unencrypted.
 *
 * Face templates are kept in SeetaFace's FaceDatabase. It can only read/write a file path, so the
 * file is written to a private temporary folder, encrypted into the vault, and the plaintext is
 * wiped immediately. Leftover plaintext from a crash is wiped on start.
 *
 * NOT thread safe: every call must come from one thread (the bridge uses a single-thread executor).
 */
class FaceEngine(private val ctx: Context, private val store: Store) {
    private var detector: FaceDetector? = null
    private var landmarker: FaceLandmarker? = null
    private var antiSpoof: FaceAntiSpoofing? = null
    private var db: FaceDatabase? = null
    private var defaultClarity = 0.3f
    private var modelsDir: File? = null

    /** faceIndex (SeetaFace's id) -> studentId. A student can own several indexes (one per enrolment frame). */
    private val studentOfIndex = HashMap<Long, String>()
    private val tmpDir = File(ctx.noBackupFilesDir, "face_tmp")
    private val dbSealed = File(store.dir, "faces.enc")
    private val mapSealed = File(store.dir, "faces_map.enc")
    var cfg: Cfg = Cfg()
    val ready get() = db != null

    @Volatile var progress: JSONObject = JSONObject().put("phase", "idle")

    // ------------------------------------------------------------------ init
    /** Downloads (first run only, needs internet) and verifies the models, then loads them and the sealed face database. */
    fun init() {
        if (ready) return
        store.kvGet("engine_cfg")?.let { cfg = Cfg.from(JSONObject(it)) }
        progress = JSONObject().put("phase", "models").put("percent", 0)
        val listener = object : GdFaceDownloadProgressListener {
            override fun onFileProgress(fileName: String, fileIndex: Int, fileCount: Int, bytesDownloaded: Long, totalBytes: Long) {
                val frac = if (totalBytes > 0) bytesDownloaded.toDouble() / totalBytes else 0.0
                progress = JSONObject().put("phase", "models").put("file", fileName)
                    .put("percent", (((fileIndex + frac) / max(fileCount, 1)) * 100).toInt())
            }
        }
        val dir = try {
            runBlocking { GdFaceModelProvider(ctx, GdFaceSDK.authorizeUrl, GdFaceSDK.apiKey).ensureModelsAvailable(listener) }
        } catch (e: GdFaceLicenseException) {
            progress = JSONObject().put("phase", "error").put("message", e.message ?: "Model download failed")
            throw e
        }
        modelsDir = dir
        fun m(vararg names: String) = SeetaModelSetting(0, names.map { File(dir, it).absolutePath }.toTypedArray(), SeetaDevice.SEETA_DEVICE_CPU)
        detector = FaceDetector(m("face_detector.csta"))
        landmarker = FaceLandmarker(m("face_landmarker_pts5.csta"))
        antiSpoof = FaceAntiSpoofing(m("fas_first.csta", "fas_second.csta")).also {
            val c = FloatArray(1); val r = FloatArray(1); it.GetThreshold(c, r); defaultClarity = c[0]
            it.SetThreshold(defaultClarity, cfg.livenessReality)
        }
        db = FaceDatabase(m("face_recognizer.csta"))
        loadFaces()
        progress = JSONObject().put("phase", "ready")
    }

    private fun recognizerSha(): String? = try {
        val files = JSONObject(File(modelsDir, "manifest.json").readText()).getJSONArray("files")
        (0 until files.length()).map { files.getJSONObject(it) }.firstOrNull { it.getString("name") == "face_recognizer.csta" }?.getString("sha256")
    } catch (e: Exception) { null }

    fun applyConfig(newCfg: Cfg) {
        cfg = newCfg
        store.kvPut("engine_cfg", newCfg.toJson().toString())
        antiSpoof?.SetThreshold(defaultClarity, newCfg.livenessReality)
    }

    // ------------------------------------------------------------------ encrypted face storage
    private fun loadFaces() {
        tmpDir.listFiles()?.forEach { Vault.wipe(it) } // plaintext left by a crash
        tmpDir.mkdirs()
        studentOfIndex.clear()
        if (!dbSealed.exists()) return
        val plain = File(tmpDir, "faces.db")
        try {
            // The templates are only valid for the recognizer model they were made with.
            val marker = store.kvGet("faces_model_sha")
            val sha = recognizerSha()
            if (marker != null && sha != null && marker != sha) { clearAll(); return }
            Vault.writeAtomic(plain, Vault.readSealed(dbSealed))
            db?.Load(plain.absolutePath)
            val map = JSONObject(String(Vault.readSealed(mapSealed)))
            map.keys().forEach { studentOfIndex[it.toLong()] = map.getString(it) }
        } finally {
            Vault.wipe(plain)
        }
    }

    private fun persist() {
        tmpDir.mkdirs()
        val plain = File(tmpDir, "faces.db")
        try {
            if (db?.Save(plain.absolutePath) != true) throw IllegalStateException("Could not save the face database")
            Vault.writeSealed(dbSealed, plain.readBytes())
        } finally {
            Vault.wipe(plain)
        }
        val map = JSONObject(); studentOfIndex.forEach { (i, s) -> map.put(i.toString(), s) }
        Vault.writeSealed(mapSealed, map.toString().toByteArray())
        recognizerSha()?.let { store.kvPut("faces_model_sha", it) }
    }

    fun enrolledStudents(): List<String> = studentOfIndex.values.toSortedSet().toList()

    fun deleteStudents(ids: Collection<String>) {
        val d = db ?: return
        val victims = studentOfIndex.filterValues { it in ids }.keys.toList()
        if (victims.isEmpty()) return
        victims.forEach { d.Delete(it); studentOfIndex.remove(it) }
        persist()
    }

    fun clearAll() {
        db?.Clear(); studentOfIndex.clear()
        Vault.wipe(File(tmpDir, "faces.db")); dbSealed.delete(); mapSealed.delete()
        store.kvDelete("faces_model_sha")
    }

    // ------------------------------------------------------------------ image helpers
    companion object {
        /** Decodes a JPEG, applies its EXIF rotation and downsizes it to at most [maxEdge] pixels. */
        fun decode(path: String, maxEdge: Int = 1280): Bitmap? {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(path, bounds)
            if (bounds.outWidth <= 0) return null
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxEdge) sample *= 2
            var bmp = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }) ?: return null
            val m = Matrix()
            when (ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
                ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
                ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
                ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
                ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
            }
            val longEdge = max(bmp.width, bmp.height)
            if (longEdge > maxEdge) { val s = maxEdge.toFloat() / longEdge; m.postScale(s, s) }
            if (!m.isIdentity) bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
            return bmp
        }

        fun toNative(b: Bitmap): SeetaImageData {
            val w = b.width; val h = b.height
            val px = IntArray(w * h); b.getPixels(px, 0, w, 0, 0, w, h)
            val img = SeetaImageData(w, h, 3); val d = img.data; var i = 0
            for (p in px) { d[i++] = (p and 0xFF).toByte(); d[i++] = ((p shr 8) and 0xFF).toByte(); d[i++] = ((p shr 16) and 0xFF).toByte() } // BGR
            return img
        }
    }

    private class Face(val bmp: Bitmap, val img: SeetaImageData, val rect: SeetaRect, val pts: Array<SeetaPointF>, val facesInFrame: Int, val crowded: Boolean)

    private fun findFace(bmp: Bitmap): Face? {
        val det = detector ?: return null; val mark = landmarker ?: return null
        val img = toNative(bmp)
        val faces = det.Detect(img)
        if (faces.isNullOrEmpty()) return null
        val sorted = faces.sortedByDescending { it.width.toLong() * it.height }
        val main = sorted[0]
        val crowded = sorted.size > 1 && sorted[1].width.toLong() * sorted[1].height >= 0.4 * main.width.toLong() * main.height
        val pts = Array(mark.number()) { SeetaPointF() }
        mark.mark(img, main, pts)
        return Face(bmp, img, main, pts, sorted.size, crowded)
    }

    /** Returns null if the face is good enough, otherwise a short reason code shown to the operator. */
    private fun quality(f: Face, out: JSONObject): String? {
        val r = f.rect; val shortSide = min(r.width, r.height)
        out.put("face_px", shortSide)
        if (shortSide < cfg.minFacePx) return "too_far"
        val mx = (f.bmp.width * 0.02).toInt(); val my = (f.bmp.height * 0.02).toInt()
        if (r.x < mx || r.y < my || r.x + r.width > f.bmp.width - mx || r.y + r.height > f.bmp.height - my) return "not_centered"
        val p = f.pts
        if (p.size >= 5) {
            val dx = p[1].x - p[0].x; val dy = p[1].y - p[0].y
            val eye = hypot(dx, dy)
            val roll = Math.toDegrees(atan2(dy, dx)); out.put("roll", roll)
            if (abs(roll) > cfg.maxRollDeg) return "tilted"
            val yaw = abs(p[2].x - (p[0].x + p[1].x) / 2) / max(eye, 1.0); out.put("yaw", yaw)
            if (yaw > cfg.maxYaw) return "turned"
        }
        val (bright, sharp) = lumaStats(f.bmp, r); out.put("bright", bright).put("sharp", sharp)
        if (bright < cfg.minBright) return "too_dark"
        if (bright > cfg.maxBright) return "too_bright"
        if (sharp < cfg.minSharp) return "blurry"
        return null
    }

    /** Mean brightness and Laplacian variance (sharpness) of the face region, on a 128px grey crop. */
    private fun lumaStats(b: Bitmap, r: SeetaRect): Pair<Double, Double> {
        val x = r.x.coerceIn(0, b.width - 2); val y = r.y.coerceIn(0, b.height - 2)
        val w = r.width.coerceIn(2, b.width - x); val h = r.height.coerceIn(2, b.height - y)
        val crop = Bitmap.createBitmap(b, x, y, w, h)
        val s = Bitmap.createScaledBitmap(crop, 128, 128, true)
        val px = IntArray(128 * 128); s.getPixels(px, 0, 128, 0, 0, 128, 128)
        val g = DoubleArray(px.size) { val c = px[it]; 0.299 * ((c shr 16) and 255) + 0.587 * ((c shr 8) and 255) + 0.114 * (c and 255) }
        var sum = 0.0; for (v in g) sum += v
        var acc = 0.0; var accSq = 0.0; var n = 0
        for (yy in 1 until 127) for (xx in 1 until 127) {
            val i = yy * 128 + xx
            val lap = g[i - 1] + g[i + 1] + g[i - 128] + g[i + 128] - 4 * g[i]
            acc += lap; accSq += lap * lap; n++
        }
        if (s !== crop) crop.recycle(); s.recycle()
        return Pair(sum / g.size, accSq / n - (acc / n) * (acc / n))
    }

    private data class Live(val ok: Boolean, val unclear: Boolean, val reality: Float)

    private fun liveness(f: Face): Live {
        val a = antiSpoof ?: return Live(false, true, -1f)
        val status = a.Predict(f.img, f.rect, f.pts)
        val c = FloatArray(1); val r = FloatArray(1)
        val reality = try { a.GetPreFrameScore(c, r); r[0] } catch (e: Throwable) { -1f }
        return when (status) {
            FaceAntiSpoofing.Status.REAL -> Live(true, false, reality)
            FaceAntiSpoofing.Status.SPOOF -> Live(false, false, reality)
            else -> Live(false, true, reality)
        }
    }

    private data class Ranked(val studentId: String, val sim: Float)

    /** Best similarity per student (a student may own several templates), best first. */
    private fun rank(f: Face): List<Ranked> {
        val d = db ?: return emptyList()
        val n = 12L
        val idx = LongArray(n.toInt()); val sim = FloatArray(n.toInt())
        val found = d.QueryTop(f.img, f.pts, n, idx, sim).toInt()
        val best = HashMap<String, Float>()
        for (i in 0 until min(found, n.toInt())) {
            val sid = studentOfIndex[idx[i]] ?: continue
            best[sid] = max(best[sid] ?: -1f, sim[i])
        }
        return best.map { Ranked(it.key, it.value) }.sortedByDescending { it.sim }
    }

    // ------------------------------------------------------------------ scanning
    private class Vote(var hits: Int = 0, var minScore: Float = 1f)
    private val votes = HashMap<String, Vote>()
    private var calibLabel: String? = null
    fun setCalibrationLabel(l: String?) { calibLabel = l }

    fun scanBegin() { votes.clear(); antiSpoof?.ResetVideo() }

    /**
     * Analyses one frame. Attendance is only ever accepted ("accepted") after [Cfg.hitsRequired] frames that each
     * passed quality, liveness and a confident, unambiguous match to the SAME student. Detection alone never counts.
     */
    fun scanFrame(path: String): JSONObject {
        val out = JSONObject()
        val bmp = decode(path) ?: return out.put("status", "error").put("reason", "bad_image")
        try {
            val f = findFace(bmp) ?: return log(out.put("status", "no_face"))
            if (f.crowded) return log(out.put("status", "multiple").put("reason", "multiple_faces"))
            quality(f, out)?.let { return log(out.put("status", "poor").put("reason", it)) }
            val live = liveness(f); out.put("liveness", live.reality.toDouble())
            if (!live.ok) return log(out.put("status", if (live.unclear) "poor" else "spoof").put("reason", if (live.unclear) "liveness_unclear" else "spoof"))
            val ranked = rank(f)
            val top = ranked.firstOrNull(); val second = ranked.getOrNull(1)
            out.put("score", (top?.sim ?: 0f).toDouble()).put("second", (second?.sim ?: 0f).toDouble())
            if (top == null || top.sim < cfg.matchThreshold) { votes.clear(); return log(out.put("status", "unknown")) }
            if (second != null && top.sim - second.sim < cfg.minMargin) { votes.clear(); return log(out.put("status", "ambiguous")) }
            // a different student than earlier frames of this scan: refuse rather than guess
            if (votes.isNotEmpty() && !votes.containsKey(top.studentId)) { votes.clear(); return log(out.put("status", "ambiguous").put("reason", "changed_person")) }
            val v = votes.getOrPut(top.studentId) { Vote() }
            v.hits++; v.minScore = min(v.minScore, top.sim)
            out.put("student_id", top.studentId).put("hits", v.hits).put("hits_required", cfg.hitsRequired)
            return log(out.put("status", if (v.hits >= cfg.hitsRequired) "accepted" else "pending").put("score", v.minScore.toDouble()))
        } finally {
            bmp.recycle()
        }
    }

    private fun log(o: JSONObject): JSONObject {
        val label = calibLabel ?: return o
        try {
            val f = File(store.dir, "calibration.csv")
            if (!f.exists()) f.writeText("time,label,status,reason,score,second,liveness,face_px,roll,yaw,bright,sharp\n")
            f.appendText("${System.currentTimeMillis()},$label,${o.optString("status")},${o.optString("reason")},${o.optDouble("score", Double.NaN)},${o.optDouble("second", Double.NaN)},${o.optDouble("liveness", Double.NaN)},${o.optInt("face_px", 0)},${o.optDouble("roll", Double.NaN)},${o.optDouble("yaw", Double.NaN)},${o.optDouble("bright", Double.NaN)},${o.optDouble("sharp", Double.NaN)}\n")
        } catch (_: Exception) { }
        return o
    }

    fun calibrationCsv(): String = File(store.dir, "calibration.csv").takeIf { it.exists() }?.readText() ?: ""
    fun clearCalibration() { File(store.dir, "calibration.csv").delete() }

    // ------------------------------------------------------------------ enrolment
    private class Cap(val img: SeetaImageData, val pts: Array<SeetaPointF>)
    private var enrolId: String? = null
    private val caps = ArrayList<Cap>()

    fun enrolBegin(studentId: String) { enrolId = studentId; caps.clear(); antiSpoof?.ResetVideo() }
    fun enrolCancel() { enrolId = null; caps.clear() }

    /** Takes one enrolment frame. It must be a good-quality, live face, the same person as the first frame, and not already enrolled as another student. */
    fun enrolFrame(path: String): JSONObject {
        val out = JSONObject(); val sid = enrolId ?: return out.put("status", "error").put("reason", "not_started")
        val bmp = decode(path) ?: return out.put("status", "error").put("reason", "bad_image")
        val f = findFace(bmp) ?: run { bmp.recycle(); return out.put("status", "no_face") }
        if (f.crowded) { bmp.recycle(); return out.put("status", "multiple") }
        quality(f, out)?.let { bmp.recycle(); return out.put("status", "poor").put("reason", it) }
        val live = liveness(f)
        if (!live.ok) { bmp.recycle(); return out.put("status", "poor").put("reason", if (live.unclear) "liveness_unclear" else "spoof") }
        val d = db ?: return out.put("status", "error").put("reason", "engine_not_ready")
        if (caps.isEmpty()) {
            val other = rank(f).firstOrNull { it.studentId != sid }
            if (other != null && other.sim >= cfg.matchThreshold) return out.put("status", "duplicate").put("other_student_id", other.studentId).also { bmp.recycle() }
        } else {
            val same = d.Compare(caps[0].img, caps[0].pts, f.img, f.pts)
            if (same < cfg.matchThreshold) { bmp.recycle(); return out.put("status", "poor").put("reason", "different_person") }
        }
        caps.add(Cap(f.img, f.pts)); bmp.recycle() // f.img was copied into native memory-independent bytes; the bitmap is no longer needed
        return out.put("status", "captured").put("count", caps.size).put("needed", cfg.enrolFrames)
    }

    /** Stores the captured frames as this student's templates (replacing any earlier ones) and saves them encrypted. */
    fun enrolCommit(): JSONObject {
        val sid = enrolId ?: return JSONObject().put("ok", false).put("reason", "not_started")
        val d = db ?: return JSONObject().put("ok", false).put("reason", "engine_not_ready")
        if (caps.size < cfg.enrolFrames) return JSONObject().put("ok", false).put("reason", "need_more_frames")
        val old = studentOfIndex.filterValues { it == sid }.keys.toList()
        val added = ArrayList<Long>()
        try {
            for (c in caps) { val i = d.Register(c.img, c.pts); if (i < 0) throw IllegalStateException("Register failed"); added.add(i) }
            old.forEach { d.Delete(it); studentOfIndex.remove(it) }
            added.forEach { studentOfIndex[it] = sid }
            persist()
        } catch (e: Exception) {
            added.forEach { try { d.Delete(it) } catch (_: Exception) { } }
            return JSONObject().put("ok", false).put("reason", e.message ?: "failed")
        } finally { caps.clear(); enrolId = null }
        return JSONObject().put("ok", true).put("model_sha", recognizerSha() ?: "")
    }
}
