import 'dart:io';
import 'package:flutter/material.dart';
import 'package:in_app_update/in_app_update.dart';

class UpdateService {
  /// Checks for an update on the Play Store and prompts the user if one is available.
  static Future<void> checkForUpdate() async {
    // in_app_update is only supported on Android.
    if (!Platform.isAndroid) return;

    try {
      final AppUpdateInfo updateInfo = await InAppUpdate.checkForUpdate();
      
      if (updateInfo.updateAvailability == UpdateAvailability.developerTriggeredUpdateInProgress) {
        // If an update was already in progress (e.g., user closed app during immediate update)
        await InAppUpdate.performImmediateUpdate();
        return;
      }

      if (updateInfo.updateAvailability == UpdateAvailability.updateAvailable) {
        // Try flexible update first so the user can continue using the app while it downloads
        if (updateInfo.flexibleUpdateAllowed) {
          await InAppUpdate.startFlexibleUpdate();
          await InAppUpdate.completeFlexibleUpdate();
        } else if (updateInfo.immediateUpdateAllowed) {
          // Fallback to immediate update if flexible is not allowed
          await InAppUpdate.performImmediateUpdate();
        }
      }
    } catch (e) {
      debugPrint('Failed to check for in-app update: $e');
    }
  }
}
