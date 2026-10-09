import 'package:shared_preferences/shared_preferences.dart';

/// Utility class for SharedPreferences operations
class PrefsUtil {
  static const String _keyOnboardingComplete = 'onboarding_complete';
  static const String _keyFirstLaunch = 'first_launch';
  static const String _keyThemeMode = 'theme_mode';
  static const String _keyPhoneNumber = 'phone_number';

  static SharedPreferences? _prefs;

  /// Initialize SharedPreferences
  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  /// Get SharedPreferences instance
  static SharedPreferences get instance {
    if (_prefs == null) {
      throw Exception(
          'PrefsUtil not initialized. Call PrefsUtil.init() first.');
    }
    return _prefs!;
  }

  // ==================== ONBOARDING ====================

  /// Check if onboarding has been completed
  static bool isOnboardingComplete() {
    return instance.getBool(_keyOnboardingComplete) ?? false;
  }

  /// Mark onboarding as complete
  static Future<void> setOnboardingComplete() async {
    await instance.setBool(_keyOnboardingComplete, true);
  }

  /// Reset onboarding status (for testing)
  static Future<void> resetOnboarding() async {
    await instance.setBool(_keyOnboardingComplete, false);
  }

  // ==================== FIRST LAUNCH ====================

  /// Check if this is the first launch
  static bool isFirstLaunch() {
    return instance.getBool(_keyFirstLaunch) ?? true;
  }

  /// Mark first launch as complete
  static Future<void> setFirstLaunchComplete() async {
    await instance.setBool(_keyFirstLaunch, false);
  }

  // ==================== THEME ====================

  /// Get saved theme mode (0: system, 1: light, 2: dark)
  static int getThemeMode() {
    return instance.getInt(_keyThemeMode) ?? 0;
  }

  /// Save theme mode
  static Future<void> setThemeMode(int mode) async {
    await instance.setInt(_keyThemeMode, mode);
  }

  // ==================== PHONE NUMBER ====================

  /// Save phone number (10-digit without +91)
  static Future<void> setPhoneNumber(String phone) async {
    await instance.setString(_keyPhoneNumber, phone);
  }

  /// Get saved phone number
  static String? getPhoneNumber() {
    return instance.getString(_keyPhoneNumber);
  }

  /// Clear phone number
  static Future<void> clearPhoneNumber() async {
    await instance.remove(_keyPhoneNumber);
  }

  // ==================== AUTH TOKENS & USER INFO ====================
  
  static const String _keyAccessToken = 'access_token';
  static const String _keyRefreshToken = 'refresh_token';
  static const String _keyUserId = 'user_id';
  static const String _keyUserName = 'user_name';
  static const String _keyUserEmail = 'user_email';
  static const String _keyUserAvatar = 'user_avatar';

  /// Save API access token
  static Future<void> setAccessToken(String token) async {
    await instance.setString(_keyAccessToken, token);
  }

  /// Get API access token
  static String? getAccessToken() {
    return instance.getString(_keyAccessToken);
  }

  /// Clear API access token
  static Future<void> clearAccessToken() async {
    await instance.remove(_keyAccessToken);
  }

  /// Save API refresh token
  static Future<void> setRefreshToken(String token) async {
    await instance.setString(_keyRefreshToken, token);
  }

  /// Get API refresh token
  static String? getRefreshToken() {
    return instance.getString(_keyRefreshToken);
  }

  /// Clear API refresh token
  static Future<void> clearRefreshToken() async {
    await instance.remove(_keyRefreshToken);
  }

  /// Save User ID
  static Future<void> setUserId(String id) async {
    await instance.setString(_keyUserId, id);
  }

  /// Get User ID
  static String? getUserId() {
    return instance.getString(_keyUserId);
  }

  /// Save User Name
  static Future<void> setUserName(String name) async {
    await instance.setString(_keyUserName, name);
  }

  /// Get User Name
  static String? getUserName() {
    return instance.getString(_keyUserName);
  }

  /// Save User Email
  static Future<void> setUserEmail(String email) async {
    await instance.setString(_keyUserEmail, email);
  }

  /// Get User Email
  static String? getUserEmail() {
    return instance.getString(_keyUserEmail);
  }

  /// Save User Avatar URL
  static Future<void> setUserAvatar(String avatar) async {
    await instance.setString(_keyUserAvatar, avatar);
  }

  /// Get User Avatar URL
  static String? getUserAvatar() {
    return instance.getString(_keyUserAvatar);
  }

  /// Clear all user auth and profile data
  static Future<void> clearUserData() async {
    await instance.remove(_keyAccessToken);
    await instance.remove(_keyRefreshToken);
    await instance.remove(_keyPhoneNumber);
    await instance.remove(_keyUserId);
    await instance.remove(_keyUserName);
    await instance.remove(_keyUserEmail);
    await instance.remove(_keyUserAvatar);
  }

  // ==================== CLEAR ALL ====================

  /// Clear all preferences (for testing/debugging)
  static Future<void> clearAll() async {
    await instance.clear();
  }
}
