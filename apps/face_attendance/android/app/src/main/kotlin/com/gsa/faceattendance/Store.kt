package com.gsa.faceattendance

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Everything the phone keeps on disk, encrypted with [Vault]:
 *  - the offline attendance queue (kept until the backend acknowledges each event),
 *  - a small key/value store (device token, student roster cache, settings, admin PIN hash).
 * Lives in noBackupFilesDir, so it is excluded from Android cloud backup and device transfer.
 */
class Store(ctx: Context) {
    val dir: File = File(ctx.noBackupFilesDir, "gsa").apply { mkdirs() }
    private val queueFile = File(dir, "queue.enc")
    private val kvFile = File(dir, "kv.enc")
    private var queue = JSONArray()
    private var kv = JSONObject()
    /** Set when a stored file could not be decrypted. The unreadable file is kept (renamed), never deleted. */
    @Volatile var loadError: String? = null

    init {
        queue = loadArray(queueFile)
        kv = loadObject(kvFile)
    }

    private fun quarantine(f: File, e: Exception) {
        loadError = "${f.name} could not be read (${e.javaClass.simpleName}). It was set aside as ${f.name}.corrupt-${System.currentTimeMillis()}."
        f.renameTo(File(f.parentFile, "${f.name}.corrupt-${System.currentTimeMillis()}"))
    }
    private fun loadArray(f: File): JSONArray = try { if (f.exists()) JSONArray(String(Vault.readSealed(f))) else JSONArray() } catch (e: Exception) { quarantine(f, e); JSONArray() }
    private fun loadObject(f: File): JSONObject = try { if (f.exists()) JSONObject(String(Vault.readSealed(f))) else JSONObject() } catch (e: Exception) { quarantine(f, e); JSONObject() }

    private fun saveQueue() = Vault.writeSealed(queueFile, queue.toString().toByteArray())
    private fun saveKv() = Vault.writeSealed(kvFile, kv.toString().toByteArray())

    // ---- key/value ----
    @Synchronized fun kvGet(k: String): String? = if (kv.has(k)) kv.getString(k) else null
    @Synchronized fun kvPut(k: String, v: String) { kv.put(k, v); saveKv() }
    @Synchronized fun kvDelete(k: String) { kv.remove(k); saveKv() }

    // ---- attendance queue ----
    @Synchronized fun enqueue(ev: JSONObject) { queue.put(ev); saveQueue() }

    @Synchronized fun pending(limit: Int): JSONArray {
        val out = JSONArray()
        for (i in 0 until queue.length()) {
            val e = queue.getJSONObject(i)
            if (!e.optBoolean("rejected", false)) { out.put(e); if (out.length() >= limit) break }
        }
        return out
    }

    /** Remove events the backend has durably stored. Only called with ids from the backend's `acked` list. */
    @Synchronized fun ack(ids: Set<String>): Int {
        val keep = JSONArray(); var removed = 0
        for (i in 0 until queue.length()) {
            val e = queue.getJSONObject(i)
            if (ids.contains(e.getString("event_id"))) removed++ else keep.put(e)
        }
        if (removed > 0) { queue = keep; saveQueue() }
        return removed
    }

    /** Permanently invalid events stay on the phone for review; they are never silently dropped. */
    @Synchronized fun reject(reasons: Map<String, String>) {
        var changed = false
        for (i in 0 until queue.length()) {
            val e = queue.getJSONObject(i)
            val r = reasons[e.getString("event_id")]
            if (r != null) { e.put("rejected", true); e.put("reject_reason", r); changed = true }
        }
        if (changed) saveQueue()
    }

    @Synchronized fun rejected(): JSONArray {
        val out = JSONArray()
        for (i in 0 until queue.length()) { val e = queue.getJSONObject(i); if (e.optBoolean("rejected", false)) out.put(e) }
        return out
    }

    /** Admin action after reviewing a rejected event. */
    @Synchronized fun discard(id: String) { ack(setOf(id)) }

    @Synchronized fun counts(): JSONObject {
        var rej = 0
        for (i in 0 until queue.length()) if (queue.getJSONObject(i).optBoolean("rejected", false)) rej++
        return JSONObject().put("pending", queue.length() - rej).put("rejected", rej)
    }
}
