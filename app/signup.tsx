/**
 * signuppg.tsx
 *
 * On successful signup:
 *   1. Check if email already exists in users collection -> show error
 *   2. Create Firestore doc at users/{auto-id}:
 *        { name, email, password, provider: "email", createdAt }
 *   3. Save to AsyncStorage -> navigate home
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
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../src/config/firebase";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

type Strength = { label: string; color: string; fraction: number };

const getStrength = (pwd: string): Strength => {
  if (pwd.length === 0) return { label: "", color: "#E0E0E0", fraction: 0 };
  if (pwd.length < 6)
    return { label: "Weak", color: "#E57373", fraction: 0.33 };
  if (pwd.length < 10)
    return { label: "Fair", color: "#FFB74D", fraction: 0.66 };
  return { label: "Strong", color: "#4CAF50", fraction: 1 };
};

// -----------------------------------------------------------------------------
// Firestore signup
// -----------------------------------------------------------------------------

async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check for existing account with same email
  const existing = await getDocs(
    query(collection(db, "users"), where("email", "==", normalizedEmail)),
  );
  if (!existing.empty) {
    throw { code: "EMAIL_EXISTS" };
  }

  // 2. Create the user document
  //    Firestore auto-generates the doc ID (acts as userId)
  const docRef = await addDoc(collection(db, "users"), {
    name: name.trim(),
    email: normalizedEmail,
    password: password, // store as-is per spec; add hashing when ready
    provider: "email",
    createdAt: serverTimestamp(),
  });

  return docRef.id; // the generated userId
}

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const strengthAnim = useRef(new Animated.Value(0)).current;
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const strength = getStrength(password);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: strength.fraction,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [password]);

  // -- Submit ----------------------------------------------------------------

  const handleSignup = async () => {
    if (!name.trim()) {
      showAlert("Missing Name", "Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      showAlert("Missing Email", "Please enter your email address.");
      return;
    }
    if (!password) {
      showAlert("Missing Password", "Please create a password.");
      return;
    }
    if (password.length < 6) {
      showAlert("Weak Password", "Password must be at least 6 characters.");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const userId = await registerUser(name, email, password);

      // Persist login state
      await AsyncStorage.setItem("userLoggedIn", "true");
      await AsyncStorage.setItem(
        "userData",
        JSON.stringify({
          uid: userId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          provider: "email",
        }),
      );

      // Navigate straight to home - no blocking Alert
      router.replace("/");
    } catch (e: any) {
      if (e?.code === "EMAIL_EXISTS") {
        showAlert(
          "Account Already Exists",
          "An account with this email already exists. Please login instead.",
        );
      } else {
        showAlert(
          "Signup Failed",
          e?.message || "Something went wrong. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // -- Render ----------------------------------------------------------------

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
          <Pressable style={s.pressableBg} onPress={Keyboard.dismiss}>
            <View style={s.blobTL} pointerEvents="none" />
            <View style={s.blobBR} pointerEvents="none" />
          </Pressable>

          {/* Back button */}
          <Animated.View style={[s.backRow, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.backArrow}>←</Text>
              <Text style={s.backText}>Back to Login</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Header */}
          <Animated.View
            style={[
              s.header,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={s.iconBadge}>
              <Text style={s.headerEmoji}>🌱</Text>
            </View>
            <Text style={s.heading}>Create Account</Text>
            <Text style={s.subheading}>
              Join thousands of farmers growing smarter
            </Text>
          </Animated.View>

          {/* Form card */}
          <Animated.View
            style={[
              s.card,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Name */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Full Name</Text>
              <View style={[s.inputRow, nameFocused && s.inputRowFocused]}>
                <Text style={s.fieldIcon}>👤</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="Your full name"
                  placeholderTextColor="#AAAAAA"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  blurOnSubmit={false}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Email */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Email Address</Text>
              <View style={[s.inputRow, emailFocused && s.inputRowFocused]}>
                <Text style={s.fieldIcon}>✉️</Text>
                <TextInput
                  ref={emailRef}
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
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Password</Text>
              <View style={[s.inputRow, passFocused && s.inputRowFocused]}>
                <Text style={s.fieldIcon}>🔒</Text>
                <TextInput
                  ref={passRef}
                  style={s.textInput}
                  placeholder="Create a strong password"
                  placeholderTextColor="#AAAAAA"
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  onSubmitEditing={handleSignup}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPass((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={s.eyeBtn}>{showPass ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>

              {/* Strength bar */}
              {password.length > 0 && (
                <View style={s.strengthRow}>
                  <View style={s.strengthTrack}>
                    <Animated.View
                      style={[
                        s.strengthFill,
                        { flex: strengthAnim, backgroundColor: strength.color },
                      ]}
                    />
                    <Animated.View
                      style={{ flex: Animated.subtract(1, strengthAnim) }}
                    />
                  </View>
                  <Text style={[s.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Terms */}
            <View style={s.termsWrap}>
              <Text style={s.termsText}>
                By signing up you agree to our{" "}
                <Text style={s.termsLink}>Terms of Service</Text> and{" "}
                <Text style={s.termsLink}>Privacy Policy</Text>.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[s.primaryBtn, loading && s.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.primaryBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Feature pills */}
            <View style={s.pillRow}>
              {["🌦 Weather Alerts", "🌿 Crop Tips", "📊 Market Prices"].map(
                (f, i) => (
                  <View key={i} style={s.pill}>
                    <Text style={s.pillText}>{f}</Text>
                  </View>
                ),
              )}
            </View>

            {/* Login link */}
            <View style={s.loginRow}>
              <Text style={s.loginPrompt}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                disabled={loading}
              >
                <Text style={s.loginLink}>Login</Text>
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
  blobTL: {
    position: "absolute",
    top: -50,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#2E7D32",
    opacity: 0.35,
  },
  blobBR: {
    position: "absolute",
    bottom: 80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#A5D6A7",
    opacity: 0.15,
  },

  backRow: { width: "100%", marginTop: 20, marginBottom: 4 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backArrow: { color: "white", fontSize: 22 },
  backText: { color: "white", fontSize: 14, fontWeight: "600" },

  header: { alignItems: "center", marginTop: 12, marginBottom: 28 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  headerEmoji: { fontSize: 36 },
  heading: {
    fontSize: 30,
    fontWeight: "800",
    color: "white",
    letterSpacing: 0.5,
  },
  subheading: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
    textAlign: "center",
  },

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

  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 10,
  },
  strengthTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "#E8E8E8",
    borderRadius: 4,
    overflow: "hidden",
    flexDirection: "row",
  },
  strengthFill: { height: 5, borderRadius: 4 },
  strengthLabel: {
    fontSize: 12,
    fontWeight: "700",
    width: 46,
    textAlign: "right",
  },

  termsWrap: { marginBottom: 20 },
  termsText: {
    fontSize: 12,
    color: "#888",
    lineHeight: 18,
    textAlign: "center",
  },
  termsLink: { color: GREEN, fontWeight: "600" },

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

  pillRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 22,
  },
  pill: {
    backgroundColor: GREEN_BG,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  pillText: { color: GREEN, fontSize: 11, fontWeight: "500" },

  loginRow: { flexDirection: "row", justifyContent: "center" },
  loginPrompt: { color: "#888", fontSize: 14 },
  loginLink: { color: GREEN, fontSize: 14, fontWeight: "700" },
});
