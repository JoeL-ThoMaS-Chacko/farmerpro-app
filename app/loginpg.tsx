/**
 * loginpg.tsx
 *
 * Requires your app/firebase.ts to export:
 *   export const db      -- Firestore instance  (getFirestore(app))
 *   export const auth    -- Firebase Auth       (getAuth(app))
 *   export const googleProvider -- GoogleAuthProvider instance
 *
 * Firestore users collection shape:
 *   users/{userId}  { name, email, password, provider, createdAt }
 *
 * Email login flow:
 *   1. Query users collection for a doc where email matches
 *   2. If no doc -> "No account found, please sign up"
 *   3. If doc found but password mismatch -> "Wrong password"
 *   4. If match -> save to AsyncStorage, navigate home
 *
 * Google login flow:
 *   1. signInWithPopup (web) / signInWithRedirect (native)
 *   2. Upsert a doc in users/{uid} with Google profile data
 *   3. Save to AsyncStorage, navigate home
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Firebase v9 modular imports
import { signInWithPopup } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db, googleProvider } from "../src/config/firebase";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Persist login state to AsyncStorage so _layout.tsx keeps the user logged in */
const persistLogin = async (userData: {
  uid: string;
  name: string;
  email: string;
  provider: string;
}) => {
  await AsyncStorage.setItem("userLoggedIn", "true");
  await AsyncStorage.setItem("userData", JSON.stringify(userData));
};

/** Show an alert that works on both web and native */
const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// -----------------------------------------------------------------------------
// Email/password login - looks up Firestore users collection
// -----------------------------------------------------------------------------

async function emailLogin(email: string, password: string): Promise<void> {
  // Step 1: find any user doc with this email
  const usersRef = collection(db, "users");
  const emailSnap = await getDocs(
    query(usersRef, where("email", "==", email.trim().toLowerCase())),
  );

  if (emailSnap.empty) {
    // No account with that email at all
    throw { code: "NO_ACCOUNT" };
  }

  // Step 2: check password on the matched doc
  const userDoc = emailSnap.docs[0];
  const userData = userDoc.data();

  if (userData.password !== password) {
    throw { code: "WRONG_PASSWORD" };
  }

  // Step 3: success - persist and return
  await persistLogin({
    uid: userDoc.id,
    name: userData.name || "",
    email: userData.email || email,
    provider: userData.provider || "email",
  });
}

// -----------------------------------------------------------------------------
// Google login
// -----------------------------------------------------------------------------

async function googleLogin(): Promise<void> {
  // signInWithPopup works on web; for native you'd use expo-auth-session
  // This will throw on native - swap the import for your native Google flow if needed
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  // Upsert user doc - merge: true so existing fields (like password) are kept
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: user.displayName || "",
      email: (user.email || "").toLowerCase(),
      provider: "google",
      password: "gauthenticate", // sentinel value as per your spec
    },
    { merge: true },
  );

  await persistLogin({
    uid: user.uid,
    name: user.displayName || "",
    email: user.email || "",
    provider: "google",
  });
}

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const passRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // -- Email login handler ---------------------------------------------------

  const handleLogin = async () => {
    if (!email.trim()) {
      showAlert("Missing Email", "Please enter your email address.");
      return;
    }
    if (!password) {
      showAlert("Missing Password", "Please enter your password.");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      await emailLogin(email, password);
      router.replace("/");
    } catch (e: any) {
      if (e?.code === "NO_ACCOUNT") {
        showAlert(
          "No Account Found",
          "No account registered with that email. Please sign up first.",
        );
      } else if (e?.code === "WRONG_PASSWORD") {
        showAlert(
          "Wrong Password",
          "The password you entered is incorrect. Please try again.",
        );
      } else {
        showAlert(
          "Login Failed",
          e?.message || "Something went wrong. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // -- Google login handler --------------------------------------------------

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await googleLogin();
      router.replace("/");
    } catch (e: any) {
      // User closed the popup - don't show an error
      if (
        e?.code === "auth/popup-closed-by-user" ||
        e?.code === "auth/cancelled-popup-request"
      )
        return;
      showAlert(
        "Google Sign-In Failed",
        e?.message || "Could not sign in with Google.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // -- Skip (guest) ----------------------------------------------------------

  const handleSkip = async () => {
    await AsyncStorage.setItem("userLoggedIn", "guest");
    await AsyncStorage.setItem(
      "userData",
      JSON.stringify({ name: "Guest", provider: "guest" }),
    );
    router.replace("/");
  };

  // -- Render ----------------------------------------------------------------

  const anyLoading = loading || googleLoading;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#388E3C" />

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Background blobs */}
          <Pressable style={s.pressableBg} onPress={Keyboard.dismiss}>
            <View style={s.blobTR} pointerEvents="none" />
            <View style={s.blobBL} pointerEvents="none" />
          </Pressable>

          {/* Logo */}
          <Animated.View style={[s.logoSection, { opacity: fadeAnim }]}>
            <View style={s.logoCircle}>
              <Text style={s.logoEmoji}>🌾</Text>
            </View>
            <Text style={s.appName}>AgriSmart</Text>
            <Text style={s.tagline}>Smart Farming Solutions</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View
            style={[
              s.card,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={s.cardTitle}>Welcome Back</Text>
            <Text style={s.cardSub}>Sign in to your farming dashboard</Text>

            {/* Email field */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Email Address</Text>
              <View style={[s.inputRow, emailFocused && s.inputRowFocused]}>
                <Text style={s.fieldIcon}>✉️</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="you@example.com"
                  placeholderTextColor="#AAAAAA"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onSubmitEditing={() => passRef.current?.focus()}
                  blurOnSubmit={false}
                  editable={!anyLoading}
                />
              </View>
            </View>

            {/* Password field */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Password</Text>
              <View style={[s.inputRow, passFocused && s.inputRowFocused]}>
                <Text style={s.fieldIcon}>🔒</Text>
                <TextInput
                  ref={passRef}
                  style={s.textInput}
                  placeholder="Enter your password"
                  placeholderTextColor="#AAAAAA"
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  onSubmitEditing={handleLogin}
                  editable={!anyLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPass((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={s.eyeBtn}>{showPass ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={s.forgotBtn}>
              <Text style={s.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login button */}
            <TouchableOpacity
              style={[s.primaryBtn, anyLoading && s.btnDisabled]}
              onPress={handleLogin}
              disabled={anyLoading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.primaryBtnText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={s.divRow}>
              <View style={s.divLine} />
              <Text style={s.divText}>or</Text>
              <View style={s.divLine} />
            </View>

            {/* Google button */}
            <TouchableOpacity
              style={[s.googleBtn, anyLoading && s.btnDisabled]}
              onPress={handleGoogleLogin}
              disabled={anyLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color="#EA4335" size="small" />
              ) : (
                <Text style={s.googleLetter}>G</Text>
              )}
              <Text style={s.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity
              style={s.skipBtn}
              onPress={handleSkip}
              disabled={anyLoading}
            >
              <Text style={s.skipText}>Skip for now</Text>
            </TouchableOpacity>

            {/* Sign up link */}
            <View style={s.signupRow}>
              <Text style={s.signupPrompt}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push("/signup")}
                disabled={anyLoading}
              >
                <Text style={s.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const GREEN = "#4CAF50";
const GREEN_DARK = "#388E3C";
const GREEN_BG = "#F0FFF0";

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN_DARK },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingBottom: 52,
  },

  pressableBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  blobTR: {
    position: "absolute",
    top: -70,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#2E7D32",
    opacity: 0.4,
  },
  blobBL: {
    position: "absolute",
    bottom: 100,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#A5D6A7",
    opacity: 0.18,
  },

  logoSection: { alignItems: "center", marginTop: 60, marginBottom: 36 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  logoEmoji: { fontSize: 44 },
  appName: {
    fontSize: 34,
    fontWeight: "800",
    color: "white",
    letterSpacing: 0.8,
  },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 6 },

  card: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 28,
    padding: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  cardSub: { fontSize: 13, color: "#888", marginBottom: 26 },

  fieldWrap: { marginBottom: 18 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: GREEN,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputRowFocused: { borderColor: GREEN, backgroundColor: GREEN_BG },
  fieldIcon: { fontSize: 16, marginRight: 10 },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
  },
  eyeBtn: { fontSize: 18, paddingLeft: 8 },

  forgotBtn: { alignSelf: "flex-end", marginBottom: 22, marginTop: -6 },
  forgotText: { color: GREEN, fontSize: 13, fontWeight: "500" },

  primaryBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    elevation: 3,
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  divRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: "#EBEBEB" },
  divText: { color: "#BBBBBB", fontSize: 12, marginHorizontal: 12 },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    marginBottom: 18,
    gap: 10,
  },
  googleLetter: { fontSize: 18, fontWeight: "900", color: "#EA4335" },
  googleText: { fontSize: 15, fontWeight: "600", color: "#333" },

  skipBtn: { alignItems: "center", paddingVertical: 6, marginBottom: 18 },
  skipText: { color: "#999", fontSize: 14 },

  signupRow: { flexDirection: "row", justifyContent: "center" },
  signupPrompt: { color: "#888", fontSize: 14 },
  signupLink: { color: GREEN, fontSize: 14, fontWeight: "700" },
});
