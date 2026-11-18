package uz.mator.smsuserconsent

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val EVENT = "onSmsConsent"
private const val REQUEST_CODE = 0x5355 // "SU"
private const val PLAY_SERVICES = "com.google.android.gms"

/**
 * Android SMS User Consent: after `start()`, the next SMS with a 4–10 character
 * code (from a sender not in the contacts) makes Play services ask the user
 * "Allow Mator to read this message?". On Allow, the message text is emitted to
 * JS, which extracts the code. Needs no SMS permission and no change to the SMS
 * text. Listening lasts at most five minutes or until `stop()`.
 */
class SmsUserConsentModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("SmsUserConsent")
    Events(EVENT)

    Function("start") {
      val context = appContext.reactContext ?: return@Function false
      unregister(context)
      val next = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
          if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
          val extras = intent.extras ?: return
          @Suppress("DEPRECATION")
          val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return
          when (status.statusCode) {
            CommonStatusCodes.SUCCESS -> {
              @Suppress("DEPRECATION")
              val consent = extras.getParcelable<Intent>(SmsRetriever.EXTRA_CONSENT_INTENT)
              launchConsent(consent)
            }
            CommonStatusCodes.TIMEOUT -> emit("timeout")
            else -> emit("error")
          }
          unregister(ctx)
        }
      }
      ContextCompat.registerReceiver(
        context,
        next,
        IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION),
        SmsRetriever.SEND_PERMISSION,
        null,
        ContextCompat.RECEIVER_EXPORTED,
      )
      receiver = next
      SmsRetriever.getClient(context).startSmsUserConsent(null)
      true
    }

    Function("stop") {
      appContext.reactContext?.let { unregister(it) }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      if (payload.resultCode == Activity.RESULT_OK) {
        val message = payload.data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
        if (message != null) emit("received", message) else emit("error")
      } else {
        emit("denied")
      }
    }

    OnDestroy {
      appContext.reactContext?.let { unregister(it) }
    }
  }

  /**
   * Launch Play services' consent screen, but only that: the intent arrives in
   * a broadcast, so it is checked to resolve to Play services and to carry no
   * URI grants before it is started (intent-redirection guard).
   */
  private fun launchConsent(consent: Intent?) {
    val activity = appContext.currentActivity
    if (consent == null || activity == null) return emit("error")
    val target = consent.resolveActivity(activity.packageManager)
    val grants = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    if (target?.packageName != PLAY_SERVICES || consent.flags and grants != 0) return emit("error")
    try {
      @Suppress("DEPRECATION")
      activity.startActivityForResult(consent, REQUEST_CODE)
    } catch (_: Exception) {
      emit("error")
    }
  }

  private fun emit(status: String, message: String? = null) {
    sendEvent(EVENT, if (message == null) mapOf("status" to status) else mapOf("status" to status, "message" to message))
  }

  private fun unregister(context: Context) {
    receiver?.let { runCatching { context.unregisterReceiver(it) } }
    receiver = null
  }
}
