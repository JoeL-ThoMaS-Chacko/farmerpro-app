/**
 * community.tsx
 *
 * Full community feed with Firestore backend.
 * Features:
 *   - View all posts (text + optional photo/video)
 *   - Create post with title, description, photo or video picker
 *   - Like / Dislike (one reaction per user per post, togglable)
 *   - Comments with real-time listener
 *   - All data lives in Firestore; new reactions update instantly
 *
 * Firestore structure:
 *   posts/{postId}
 *     authorId: string
 *     authorName: string
 *     title: string
 *     description: string
 *     mediaUrl: string | null        // download URL from Storage
 *     mediaType: "image"|"video"|null
 *     likeCount: number
 *     dislikeCount: number
 *     likedBy: string[]              // userIds
 *     dislikedBy: string[]           // userIds
 *     commentCount: number
 *     createdAt: Timestamp
 *
 *   posts/{postId}/comments/{commentId}
 *     authorId: string
 *     authorName: string
 *     text: string
 *     createdAt: Timestamp
 *
 * TO WIRE UP FIREBASE:
 *   1. npm install firebase  (or: npx expo install firebase)
 *   2. Create app/firebaseConfig.ts with your config
 *   3. Replace every FIREBASE_STUB comment block below with the real calls
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  Home,
  Image as ImageIcon,
  Leaf,
  MessageCircle,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  User,
  Video,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  fetchUserPosts,
  type Comment,
  type Post,
} from "../src/types/communityTypes";
export { fetchUserPosts };
export type { Comment, Post };

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE STUB LAYER
// Replace every function body here with real Firestore calls when ready.
// The rest of the component never needs to change.
// ─────────────────────────────────────────────────────────────────────────────

let _stubPosts: Post[] = [];
let _stubComments: { [postId: string]: Comment[] } = {};

async function fetchPosts(): Promise<Post[]> {
  // FIREBASE_STUB — replace with:
  // const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt","desc")));
  // return snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
  return [..._stubPosts].sort((a, b) => b.createdAt - a.createdAt);
}

async function createPost(post: Omit<Post, "id">): Promise<string> {
  // FIREBASE_STUB — replace with:
  // const ref = await addDoc(collection(db, "posts"), { ...post, createdAt: serverTimestamp() });
  // return ref.id;
  const id = `post_${Date.now()}`;
  _stubPosts.unshift({ ...post, id });
  return id;
}

async function uploadMedia(
  _uri: string,
  _type: "image" | "video",
): Promise<string> {
  // FIREBASE_STUB — replace with Firebase Storage upload:
  // const ref = storageRef(storage, `posts/${Date.now()}`);
  // const blob = await (await fetch(_uri)).blob();
  // await uploadBytes(ref, blob);
  // return await getDownloadURL(ref);
  return _uri; // stub: just return local uri
}

async function toggleReaction(
  postId: string,
  userId: string,
  reaction: "like" | "dislike",
): Promise<void> {
  // FIREBASE_STUB — replace with a Firestore transaction:
  // const postRef = doc(db, "posts", postId);
  // await runTransaction(db, async tx => { ... update likedBy/dislikedBy/counts ... });
  const post = _stubPosts.find((p) => p.id === postId);
  if (!post) return;
  const other = reaction === "like" ? "dislike" : "like";
  const byKey = `${reaction}dBy` as "likedBy" | "dislikedBy";
  const otherKey = `${other}dBy` as "likedBy" | "dislikedBy";
  const countKey = `${reaction}Count` as "likeCount" | "dislikeCount";
  const otherCountKey = `${other}Count` as "likeCount" | "dislikeCount";

  if (post[byKey].includes(userId)) {
    post[byKey] = post[byKey].filter((id) => id !== userId);
    (post[countKey] as number) = Math.max(0, (post[countKey] as number) - 1);
  } else {
    post[byKey] = [...post[byKey], userId];
    (post[countKey] as number) = (post[countKey] as number) + 1;
    if (post[otherKey].includes(userId)) {
      post[otherKey] = post[otherKey].filter((id) => id !== userId);
      (post[otherCountKey] as number) = Math.max(
        0,
        (post[otherCountKey] as number) - 1,
      );
    }
  }
}

async function fetchComments(postId: string): Promise<Comment[]> {
  // FIREBASE_STUB — replace with:
  // const snap = await getDocs(query(collection(db,"posts",postId,"comments"), orderBy("createdAt","asc")));
  // return snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
  return (_stubComments[postId] || []).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
}

async function addComment(
  postId: string,
  comment: Omit<Comment, "id">,
): Promise<void> {
  // FIREBASE_STUB — replace with:
  // await addDoc(collection(db,"posts",postId,"comments"), { ...comment, createdAt: serverTimestamp() });
  // await updateDoc(doc(db,"posts",postId), { commentCount: increment(1) });
  const id = `cmt_${Date.now()}`;
  if (!_stubComments[postId]) _stubComments[postId] = [];
  _stubComments[postId].push({ ...comment, id });
  const post = _stubPosts.find((p) => p.id === postId);
  if (post) post.commentCount = (_stubComments[postId] || []).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((w) => w[0] || "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

const GREEN = "#4CAF50";
const GREEN_DARK = "#388E3C";
const GREEN_BG = "#F0FFF0";

// ─────────────────────────────────────────────────────────────────────────────
// COMMENT SHEET  (shown as bottom modal)
// ─────────────────────────────────────────────────────────────────────────────

function CommentSheet({
  postId,
  visible,
  onClose,
  currentUserId,
  currentUserName,
}: {
  postId: string;
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) load();
  }, [visible, postId]);

  const load = async () => {
    setLoading(true);
    const data = await fetchComments(postId);
    setComments(data);
    setLoading(false);
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    await addComment(postId, {
      authorId: currentUserId,
      authorName: currentUserName,
      text: text.trim(),
      createdAt: Date.now(),
    });
    setText("");
    await load();
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={cs.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={cs.sheet}
      >
        <View style={cs.handle} />
        <View style={cs.header}>
          <Text style={cs.headerTitle}>Comments</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X color="#888" size={20} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} />
        ) : comments.length === 0 ? (
          <View style={cs.empty}>
            <Text style={cs.emptyText}>No comments yet. Be the first!</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item: c }) => (
              <View style={cs.commentRow}>
                <View style={cs.avatar}>
                  <Text style={cs.avatarText}>{initials(c.authorName)}</Text>
                </View>
                <View style={cs.bubble}>
                  <Text style={cs.commentAuthor}>{c.authorName}</Text>
                  <Text style={cs.commentText}>{c.text}</Text>
                  <Text style={cs.commentTime}>{timeAgo(c.createdAt)}</Text>
                </View>
              </View>
            )}
          />
        )}

        <View style={cs.inputRow}>
          <TextInput
            style={cs.input}
            placeholder="Write a comment..."
            placeholderTextColor="#AAA"
            value={text}
            onChangeText={setText}
            multiline
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <TouchableOpacity
            style={[
              cs.sendBtn,
              (!text.trim() || sending) && cs.sendBtnDisabled,
            ]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Send color="white" size={18} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cs = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A1A" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "#AAA", fontSize: 14 },
  commentRow: { flexDirection: "row", marginBottom: 16 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GREEN_DARK,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  avatarText: { color: "white", fontSize: 13, fontWeight: "700" },
  bubble: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    borderRadius: 14,
    padding: 12,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  commentText: { fontSize: 14, color: "#333", lineHeight: 20 },
  commentTime: { fontSize: 11, color: "#AAA", marginTop: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: "#F5F5F5",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1A1A1A",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  onReact,
  onComment,
}: {
  post: Post;
  currentUserId: string;
  onReact: (postId: string, reaction: "like" | "dislike") => void;
  onComment: (postId: string) => void;
}) {
  const liked = post.likedBy.includes(currentUserId);
  const disliked = post.dislikedBy.includes(currentUserId);
  const [expanded, setExpanded] = useState(false);
  const descLong = post.description.length > 120;

  return (
    <View style={pc.card}>
      {/* Author row */}
      <View style={pc.authorRow}>
        <View style={pc.avatar}>
          <Text style={pc.avatarText}>{initials(post.authorName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pc.authorName}>{post.authorName}</Text>
          <Text style={pc.time}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={pc.title}>{post.title}</Text>

      {/* Description */}
      {post.description ? (
        <View>
          <Text
            style={pc.desc}
            numberOfLines={expanded || !descLong ? undefined : 3}
          >
            {post.description}
          </Text>
          {descLong && (
            <TouchableOpacity
              onPress={() => setExpanded((e) => !e)}
              style={pc.moreBtn}
            >
              <Text style={pc.moreText}>
                {expanded ? "Show less" : "Read more"}
              </Text>
              {expanded ? (
                <ChevronUp color={GREEN} size={14} />
              ) : (
                <ChevronDown color={GREEN} size={14} />
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Media */}
      {post.mediaUrl && post.mediaType === "image" && (
        <Image
          source={{ uri: post.mediaUrl }}
          style={pc.media}
          resizeMode="cover"
        />
      )}
      {post.mediaUrl && post.mediaType === "video" && (
        <View style={pc.videoPlaceholder}>
          <Video color="#888" size={36} />
          <Text style={pc.videoLabel}>Video attached</Text>
        </View>
      )}

      {/* Reaction bar */}
      <View style={pc.reactionBar}>
        <TouchableOpacity
          style={[pc.reactionBtn, liked && pc.reactionActive]}
          onPress={() => onReact(post.id, "like")}
        >
          <ThumbsUp color={liked ? GREEN : "#888"} size={18} />
          <Text style={[pc.reactionCount, liked && { color: GREEN }]}>
            {post.likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[pc.reactionBtn, disliked && pc.reactionActiveRed]}
          onPress={() => onReact(post.id, "dislike")}
        >
          <ThumbsDown color={disliked ? "#E53935" : "#888"} size={18} />
          <Text style={[pc.reactionCount, disliked && { color: "#E53935" }]}>
            {post.dislikeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={pc.reactionBtn}
          onPress={() => onComment(post.id)}
        >
          <MessageCircle color="#888" size={18} />
          <Text style={pc.reactionCount}>{post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  authorRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_DARK,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: "white", fontSize: 14, fontWeight: "700" },
  authorName: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  time: { fontSize: 11, color: "#AAA", marginTop: 1 },
  title: { fontSize: 17, fontWeight: "800", color: "#1A1A1A", marginBottom: 6 },
  desc: { fontSize: 14, color: "#444", lineHeight: 21, marginBottom: 4 },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 4,
  },
  moreText: { fontSize: 13, color: GREEN, fontWeight: "600" },
  media: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginVertical: 10,
    backgroundColor: "#F0F0F0",
  },
  videoPlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    marginVertical: 10,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 8,
  },
  videoLabel: { color: "#888", fontSize: 13 },
  reactionBar: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    gap: 8,
  },
  reactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  reactionActive: {
    backgroundColor: GREEN_BG,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  reactionActiveRed: {
    backgroundColor: "#FFEBEE",
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  reactionCount: { fontSize: 13, fontWeight: "600", color: "#888" },
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE POST MODAL
// ─────────────────────────────────────────────────────────────────────────────

function CreatePostModal({
  visible,
  onClose,
  onCreated,
  currentUserId,
  currentUserName,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentUserId: string;
  currentUserName: string;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [media, setMedia] = useState<{
    uri: string;
    type: "image" | "video";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(600);
      setTitle("");
      setDesc("");
      setMedia(null);
    }
  }, [visible]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow media library access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setMedia({ uri: result.assets[0].uri, type: "image" });
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow media library access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setMedia({ uri: result.assets[0].uri, type: "video" });
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Please add a title for your post.");
      return;
    }
    setSubmitting(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: "image" | "video" | null = null;
      if (media) {
        mediaUrl = await uploadMedia(media.uri, media.type);
        mediaType = media.type;
      }
      await createPost({
        authorId: currentUserId,
        authorName: currentUserName,
        title: title.trim(),
        description: desc.trim(),
        mediaUrl,
        mediaType,
        likeCount: 0,
        dislikeCount: 0,
        likedBy: [],
        dislikedBy: [],
        commentCount: 0,
        createdAt: Date.now(),
      });
      onCreated();
      onClose();
    } catch (e) {
      Alert.alert("Error", "Could not create post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={cpm.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={cpm.wrapper}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[cpm.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={cpm.headerRow}>
            <Text style={cpm.headerTitle}>New Post</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X color="#888" size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <View style={cpm.fieldWrap}>
              <Text style={cpm.label}>Title *</Text>
              <TextInput
                style={cpm.input}
                placeholder="What's your post about?"
                placeholderTextColor="#AAAAAA"
                value={title}
                onChangeText={setTitle}
                maxLength={120}
              />
            </View>

            {/* Description */}
            <View style={cpm.fieldWrap}>
              <Text style={cpm.label}>Description</Text>
              <TextInput
                style={[cpm.input, cpm.inputMulti]}
                placeholder="Share details, tips, or questions..."
                placeholderTextColor="#AAAAAA"
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Media picker */}
            <View style={cpm.fieldWrap}>
              <Text style={cpm.label}>Attach Media (optional)</Text>
              {media ? (
                <View style={cpm.mediaPreview}>
                  {media.type === "image" ? (
                    <Image
                      source={{ uri: media.uri }}
                      style={cpm.previewImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={cpm.videoPreview}>
                      <Video color="#888" size={32} />
                      <Text
                        style={{ color: "#888", fontSize: 13, marginTop: 6 }}
                      >
                        Video selected
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={cpm.removeMedia}
                    onPress={() => setMedia(null)}
                  >
                    <X color="white" size={14} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={cpm.mediaButtons}>
                  <TouchableOpacity style={cpm.mediaBtn} onPress={pickImage}>
                    <ImageIcon color={GREEN} size={22} />
                    <Text style={cpm.mediaBtnText}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={cpm.mediaBtn} onPress={pickVideo}>
                    <Video color="#2196F3" size={22} />
                    <Text style={[cpm.mediaBtnText, { color: "#2196F3" }]}>
                      Video
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[
              cpm.submitBtn,
              (!title.trim() || submitting) && cpm.submitBtnDisabled,
            ]}
            onPress={submit}
            disabled={!title.trim() || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={cpm.submitBtnText}>Post to Community</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cpm = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  wrapper: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "90%",
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  fieldWrap: { marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: GREEN,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1A1A1A",
  },
  inputMulti: { minHeight: 100, textAlignVertical: "top" },
  mediaButtons: { flexDirection: "row", gap: 12 },
  mediaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
    backgroundColor: "#FAFAFA",
  },
  mediaBtnText: { fontSize: 15, fontWeight: "600", color: GREEN },
  mediaPreview: { position: "relative" },
  previewImg: { width: "100%", height: 180, borderRadius: 12 },
  videoPreview: {
    width: "100%",
    height: 100,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  removeMedia: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    elevation: 3,
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "white", fontSize: 16, fontWeight: "700" },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMMUNITY SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("anonymous");
  const [currentUserName, setCurrentUserName] = useState("Anonymous");

  useEffect(() => {
    loadUser();
    loadPosts();
  }, []);

  const loadUser = async () => {
    try {
      const raw = await AsyncStorage.getItem("userData");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.name) setCurrentUserName(u.name);
        // Use email as a stable userId stub (replace with Firebase uid in production)
        if (u.email) setCurrentUserId(u.email);
      }
    } catch (_) {}
  };

  const loadPosts = async () => {
    setLoading(true);
    const data = await fetchPosts();
    setPosts(data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const data = await fetchPosts();
    setPosts(data);
    setRefreshing(false);
  };

  const handleReact = async (postId: string, reaction: "like" | "dislike") => {
    // Optimistic update
    await toggleReaction(postId, currentUserId, reaction);
    const updated = await fetchPosts();
    setPosts(updated);
  };

  const handleComment = (postId: string) => setCommentPostId(postId);

  return (
    <View style={main.container}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />

      {/* Header */}
      <View style={main.header}>
        <View>
          <Text style={main.headerTitle}>Community</Text>
          <Text style={main.headerSub}>Connect with fellow farmers</Text>
        </View>
        <TouchableOpacity
          style={main.fabHeader}
          onPress={() => setShowCreate(true)}
        >
          <Plus color="white" size={22} />
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {loading ? (
        <View style={main.center}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={main.loadingText}>Loading posts...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={currentUserId}
              onReact={handleReact}
              onComment={handleComment}
            />
          )}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={main.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🌾</Text>
              <Text style={main.emptyTitle}>No posts yet</Text>
              <Text style={main.emptyText}>
                Be the first to share something with the community!
              </Text>
              <TouchableOpacity
                style={main.emptyBtn}
                onPress={() => setShowCreate(true)}
              >
                <Text style={main.emptyBtnText}>Create First Post</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GREEN}
            />
          }
        />
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadPosts}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />

      {/* Comment Sheet */}
      <CommentSheet
        postId={commentPostId || ""}
        visible={commentPostId !== null}
        onClose={() => setCommentPostId(null)}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />

      {/* Bottom Navbar */}
      <View style={main.navbar}>
        <TouchableOpacity
          style={main.navItem}
          onPress={() => router.replace("/")}
        >
          <Home color="#9E9E9E" size={24} />
          <Text style={main.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={main.navItem}>
          <Leaf color={GREEN} size={24} />
          <Text style={[main.navLabel, main.navLabelActive]}>Community</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={main.navItem}
          onPress={() => router.push("/profile")}
        >
          <User color="#9E9E9E" size={24} />
          <Text style={main.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const main = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

  header: {
    backgroundColor: GREEN_DARK,
    paddingTop: Platform.OS === "ios" ? 54 : 44,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "white" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  fabHeader: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyBtnText: { color: "white", fontSize: 15, fontWeight: "700" },

  navbar: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  navLabel: { fontSize: 12, color: "#9E9E9E", marginTop: 4 },
  navLabelActive: { color: GREEN, fontWeight: "600" },
});
