import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Leaf,
  MessageCircle,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { fetchUserPosts, type Post } from "../src/types/communityTypes";

interface UserData {
  name?: string;
  email?: string;
  provider?: string;
}

const navigateToLogin = () => {
  if (Platform.OS === "web") {
    (window as any).location.href = "/loginpg";
  } else {
    router.replace("/loginpg");
  }
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function MyPostCard({ post }: { post: Post }) {
  return (
    <View style={p.postCard}>
      <Text style={p.postTitle} numberOfLines={1}>
        {post.title}
      </Text>
      {post.description ? (
        <Text style={p.postDesc} numberOfLines={2}>
          {post.description}
        </Text>
      ) : null}
      {post.mediaUrl && post.mediaType === "image" && (
        <Image
          source={{ uri: post.mediaUrl }}
          style={p.postThumb}
          resizeMode="cover"
        />
      )}
      <View style={p.postMeta}>
        <Text style={p.postTime}>{timeAgo(post.createdAt)}</Text>
        <View style={p.postStats}>
          <ThumbsUp color="#888" size={13} />
          <Text style={p.statText}>{post.likeCount}</Text>
          <ThumbsDown color="#888" size={13} />
          <Text style={p.statText}>{post.dislikeCount}</Text>
          <MessageCircle color="#888" size={13} />
          <Text style={p.statText}>{post.commentCount}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [data, status] = await Promise.all([
        AsyncStorage.getItem("userData"),
        AsyncStorage.getItem("userLoggedIn"),
      ]);
      if (data) {
        const parsed = JSON.parse(data);
        setUserData(parsed);
        const uid = parsed.email || "anonymous";
        loadMyPosts(uid);
      }
      setLoginStatus(status);
    } catch (e) {
      console.warn("Profile load error:", e);
    }
  };

  const loadMyPosts = async (uid: string) => {
    setPostsLoading(true);
    const posts = await fetchUserPosts(uid);
    setMyPosts(posts);
    setPostsLoading(false);
  };

  const doLogout = async () => {
    try {
      await AsyncStorage.multiRemove(["userLoggedIn", "userData"]);
      navigateToLogin();
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const ok = (global as any).confirm?.("Are you sure you want to logout?");
      if (ok) doLogout();
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: doLogout },
      ]);
    }
  };

  const handleClearHistory = () => {
    if (Platform.OS === "web") {
      const ok = (global as any).confirm?.(
        "This will delete all your saved crop predictions.",
      );
      if (ok) AsyncStorage.removeItem("cropPredictionHistory");
    } else {
      Alert.alert(
        "Clear History",
        "This will delete all your saved crop predictions.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear",
            style: "destructive",
            onPress: () => AsyncStorage.removeItem("cropPredictionHistory"),
          },
        ],
      );
    }
  };

  const isGuest = loginStatus === "guest";
  const displayName =
    userData?.name || (isGuest ? "Guest User" : "AgriSmart User");
  const displayEmail = userData?.email || (isGuest ? "Not signed in" : "");

  const providerLabel = () => {
    if (isGuest) return "Guest";
    switch (userData?.provider) {
      case "google":
        return "Google Account";
      case "email":
        return "Email & Password";
      default:
        return "Email & Password";
    }
  };

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const totalLikes = myPosts.reduce((a, p) => a + p.likeCount, 0);
  const totalComments = myPosts.reduce((a, p) => a + p.commentCount, 0);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#388E3C" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft color="white" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + stats */}
        <View style={s.avatarCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials || "🌾"}</Text>
          </View>
          <Text style={s.userName}>{displayName}</Text>
          {displayEmail ? (
            <Text style={s.userEmail}>{displayEmail}</Text>
          ) : null}
          <View style={s.providerBadge}>
            <Text style={s.providerText}>
              {isGuest ? "👤" : userData?.provider === "google" ? "G" : "✉️"}
              {"  "}
              {providerLabel()}
            </Text>
          </View>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statNumber}>{myPosts.length}</Text>
              <Text style={s.statLabel}>Posts</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNumber}>{totalLikes}</Text>
              <Text style={s.statLabel}>Likes received</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNumber}>{totalComments}</Text>
              <Text style={s.statLabel}>Comments</Text>
            </View>
          </View>
        </View>

        {/* Account info */}
        {!isGuest && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Account Information</Text>
            <View style={s.card}>
              <InfoRow icon="👤" label="Name" value={displayName} />
              <Divider />
              <InfoRow icon="✉️" label="Email" value={displayEmail || "—"} />
              <Divider />
              <InfoRow
                icon="🔐"
                label="Sign-in method"
                value={providerLabel()}
              />
            </View>
          </View>
        )}

        {/* My Posts */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>My Posts</Text>
            <TouchableOpacity onPress={() => router.push("/community")}>
              <Text style={s.seeAllText}>View Community</Text>
            </TouchableOpacity>
          </View>

          {postsLoading ? (
            <View style={s.postsEmpty}>
              <Text style={s.postsEmptyText}>Loading posts...</Text>
            </View>
          ) : myPosts.length === 0 ? (
            <View style={s.postsEmpty}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🌱</Text>
              <Text style={s.postsEmptyText}>You haven't posted yet</Text>
              <TouchableOpacity
                style={s.postNowBtn}
                onPress={() => router.push("/community")}
              >
                <Text style={s.postNowBtnText}>Post to Community</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={myPosts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MyPostCard post={item} />}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* App settings */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>App Settings</Text>
          <View style={s.card}>
            <ActionRow
              icon="🗑️"
              label="Clear Prediction History"
              sublabel="Remove all saved crop predictions"
              onPress={handleClearHistory}
            />
          </View>
        </View>

        {/* About */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>About</Text>
          <View style={s.card}>
            <ActionRow icon="🌾" label="AgriSmart" sublabel="Version 1.0.0" />
            <Divider />
            <ActionRow icon="📄" label="Terms of Service" />
            <Divider />
            <ActionRow icon="🔒" label="Privacy Policy" />
          </View>
        </View>

        {/* Logout */}
        <View style={s.section}>
          {isGuest ? (
            <TouchableOpacity
              style={s.loginBtn}
              onPress={navigateToLogin}
              activeOpacity={0.7}
            >
              <Text style={s.loginBtnText}>Login / Create Account</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={s.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={s.navbar}>
        <TouchableOpacity
          style={s.navItem}
          onPress={() =>
            Platform.OS === "web"
              ? ((window as any).location.href = "/")
              : router.replace("/")
          }
        >
          <Home color="#9E9E9E" size={24} />
          <Text style={s.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.navItem}
          onPress={() => router.push("/community")}
        >
          <Leaf color="#9E9E9E" size={24} />
          <Text style={s.navLabel}>Community</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem}>
          <User color="#4CAF50" size={24} />
          <Text style={[s.navLabel, s.navLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={s.rowTextWrap}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
}) {
  const inner = (
    <View style={s.actionRow}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={s.rowTextWrap}>
        <Text style={s.actionLabel}>{label}</Text>
        {sublabel ? <Text style={s.actionSublabel}>{sublabel}</Text> : null}
      </View>
      {onPress ? <ChevronRight color="#BBBBBB" size={18} /> : null}
    </View>
  );
  if (onPress)
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  return inner;
}

function Divider() {
  return <View style={s.divider} />;
}

const GREEN = "#4CAF50";
const GREEN_DARK = "#388E3C";

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5", flexDirection: "column" },
  header: {
    backgroundColor: GREEN_DARK,
    paddingTop: Platform.OS === "ios" ? 54 : 44,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "white" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  avatarCard: {
    backgroundColor: GREEN_DARK,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    elevation: 8,
  },
  avatarText: { fontSize: 34, fontWeight: "700", color: "white" },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
  },
  userEmail: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 12 },
  providerBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    marginBottom: 20,
  },
  providerText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: "100%",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  statItem: { alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: "800", color: "white" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.25)" },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  seeAllText: { fontSize: 13, color: GREEN, fontWeight: "600" },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowIcon: { fontSize: 20, marginRight: 14, width: 28, textAlign: "center" },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 12, color: "#999", marginBottom: 2 },
  rowValue: { fontSize: 15, color: "#1A1A1A", fontWeight: "500" },
  actionLabel: { fontSize: 15, color: "#1A1A1A", fontWeight: "500" },
  actionSublabel: { fontSize: 12, color: "#999", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginLeft: 58 },
  postsEmpty: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    elevation: 2,
  },
  postsEmptyText: { fontSize: 14, color: "#AAA", marginBottom: 16 },
  postNowBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  postNowBtnText: { color: "white", fontSize: 14, fontWeight: "700" },
  logoutBtn: {
    backgroundColor: "#FFEBEE",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFCDD2",
  },
  logoutBtnText: { color: "#E53935", fontSize: 16, fontWeight: "700" },
  loginBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    elevation: 3,
  },
  loginBtnText: { color: "white", fontSize: 16, fontWeight: "700" },
  navbar: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  navLabel: { fontSize: 12, color: "#9E9E9E", marginTop: 4 },
  navLabelActive: { color: GREEN, fontWeight: "600" },
});

const p = StyleSheet.create({
  postCard: {
    backgroundColor: "white",
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  postDesc: { fontSize: 13, color: "#555", lineHeight: 19, marginBottom: 8 },
  postThumb: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#F0F0F0",
  },
  postMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postTime: { fontSize: 11, color: "#AAA" },
  postStats: { flexDirection: "row", alignItems: "center", gap: 6 },
  statText: { fontSize: 12, color: "#888", fontWeight: "600" },
});
