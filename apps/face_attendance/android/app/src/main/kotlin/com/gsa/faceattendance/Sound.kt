package com.gsa.faceattendance

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.sin

/**
 * Short feedback sounds, generated in code (no audio files). Each one has a different shape so the operator can tell
 * them apart without looking at the screen:
 *   entry     two rising tones   (low, high)
 *   exit      two falling tones  (high, low)
 *   duplicate one short middle tone (already recorded)
 *   wrong     two low harsh buzzes (face not recognised)
 */
object Sound {
    private const val RATE = 22050
    private val patterns: Map<String, List<Pair<Double, Int>>> = mapOf(   // frequency Hz (0 = silence) to milliseconds
        "entry" to listOf(880.0 to 130, 0.0 to 40, 1320.0 to 220),
        "exit" to listOf(1320.0 to 130, 0.0 to 40, 660.0 to 220),
        "duplicate" to listOf(990.0 to 160),
        "wrong" to listOf(180.0 to 230, 0.0 to 90, 180.0 to 230),
    )

    fun play(name: String) {
        val p = patterns[name] ?: return
        Thread {
            var track: AudioTrack? = null
            try {
                val buf = render(p, harsh = name == "wrong")
                track = AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                    .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(RATE).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .setBufferSizeInBytes(buf.size * 2)
                    .build()
                track.write(buf, 0, buf.size)
                track.play()
                Thread.sleep(buf.size * 1000L / RATE + 120)
            } catch (_: Throwable) {
                // a missing sound must never affect attendance
            } finally {
                try { track?.release() } catch (_: Throwable) {}
            }
        }.start()
    }

    private fun render(p: List<Pair<Double, Int>>, harsh: Boolean): ShortArray {
        val total = p.sumOf { it.second * RATE / 1000 }
        val out = ShortArray(total)
        var at = 0
        for ((hz, ms) in p) {
            val n = ms * RATE / 1000
            for (i in 0 until n) {
                if (hz > 0) {
                    val ph = 2 * PI * hz * i / RATE
                    var v = sin(ph)
                    if (harsh) v = if (v >= 0) 0.8 else -0.8          // square wave: clearly a "no" sound
                    val edge = minOf(i, n - 1 - i).coerceAtMost(220) / 220.0   // short fade in/out, no clicks
                    out[at + i] = (v * edge * 0.85 * Short.MAX_VALUE).toInt().toShort()
                }
            }
            at += n
        }
        return out
    }
}
