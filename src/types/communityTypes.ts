import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../config/firebase";

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  likeCount: number;
  dislikeCount: number;
  likedBy: string[];
  dislikedBy: string[];
  commentCount: number;
  createdAt: number;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
}

/** Fetch all posts for a specific user from Firestore */
export async function fetchUserPosts(userId: string): Promise<Post[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("authorId", "==", userId),
        orderBy("createdAt", "desc"),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post);
  } catch (e) {
    console.warn("fetchUserPosts error:", e);
    return [];
  }
}
