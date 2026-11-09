package com.frimee.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * Invisible step between a call notification and Frimee. When Frimee's task already exists,
 * Android brings it to the front with its original intent and the call link (fremee://call/…)
 * is lost; this activity keeps the link for the web app (CallNativePlugin.takePendingCall or
 * the "callLink" event), opens Frimee and closes.
 */
class CallLinkActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        intent?.data?.toString()?.let { MainActivity.pendingCallUri = it }
        startActivity(
            Intent(this, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP,
            ),
        )
        finish()
    }
}
