package com.gsa.faceattendance

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-256-GCM encryption with a key that lives in the Android Keystore (StrongBox when the phone has it).
 * The key never leaves the secure hardware/keystore, so copying the app's files off the phone does not
 * reveal face templates, the attendance queue or the device token.
 *
 * Blob layout: [version 1 byte][iv length 1 byte][iv][ciphertext+tag]. The file name is bound in as
 * additional authenticated data, so one encrypted file cannot be swapped for another.
 */
object Vault {
    private const val ALIAS = "gsa_face_vault_v1"
    private const val VERSION: Byte = 1

    private fun secretKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        fun build(strongBox: Boolean): SecretKey {
            val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
            if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) spec.setIsStrongBoxBacked(true)
            val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            gen.init(spec.build())
            return gen.generateKey()
        }
        return try { build(true) } catch (e: Exception) { build(false) }
    }

    fun seal(name: String, plain: ByteArray): ByteArray {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, secretKey())
        c.updateAAD(name.toByteArray(Charsets.UTF_8))
        val ct = c.doFinal(plain)
        val iv = c.iv
        return byteArrayOf(VERSION, iv.size.toByte()) + iv + ct
    }

    fun open(name: String, blob: ByteArray): ByteArray {
        require(blob.size > 2 && blob[0] == VERSION) { "Unknown blob format" }
        val ivLen = blob[1].toInt() and 0xFF
        val iv = blob.copyOfRange(2, 2 + ivLen)
        val ct = blob.copyOfRange(2 + ivLen, blob.size)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
        c.updateAAD(name.toByteArray(Charsets.UTF_8))
        return c.doFinal(ct)
    }

    /** Write to a temporary file, fsync, then rename over the target: a crash never leaves a half-written file. */
    fun writeAtomic(file: File, bytes: ByteArray) {
        val tmp = File(file.parentFile, file.name + ".tmp")
        FileOutputStream(tmp).use { it.write(bytes); it.fd.sync() }
        if (!tmp.renameTo(file)) throw IOException("Could not replace ${file.name}")
    }

    fun writeSealed(file: File, plain: ByteArray) = writeAtomic(file, seal(file.name, plain))
    fun readSealed(file: File): ByteArray = open(file.name, file.readBytes())

    /** Best effort: overwrite with zeros before deleting a plaintext temporary file. */
    fun wipe(file: File) {
        try {
            if (file.exists()) {
                val len = file.length()
                FileOutputStream(file).use { out -> val z = ByteArray(8192); var left = len; while (left > 0) { val n = minOf(left, z.size.toLong()).toInt(); out.write(z, 0, n); left -= n }; out.fd.sync() }
            }
        } catch (_: Exception) { }
        file.delete()
    }
}
