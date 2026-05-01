import { useState, useEffect, useMemo } from 'react';
import { Search, Download, Star, ChevronRight, Menu, X, Gamepad2, Laptop, Smartphone, Monitor, Heart, ShoppingBag, Plus, Minus, Trash2, MessageCircle, Bell, Wrench, Users, MessageSquare, Clock, Eye, Send, LogOut, ShieldCheck, Settings, Edit, PlusCircle, Save, TrendingUp, DollarSign, Activity, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  addDoc, 
  serverTimestamp, 
  increment,
  onSnapshot
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { db, auth } from './lib/firebase';

// --- Types ---
interface Game {
  id: string;
  title: string;
  price: number;
  shortDesc: string;
  fullDesc?: string;
  thumbnail: string;
  coverImage?: string;
  downloadUrl?: string;
  fileSize?: string;
  version?: string;
  minRequirements?: string;
  platforms?: string;
  releaseDate?: string;
  downloadCount: number;
  category: string;
}

interface Category {
  id: string | number;
  name: string;
  description: string;
  thumbnail: string;
  icon: string;
}

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [relatedGames, setRelatedGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryView, setIsCategoryView] = useState(false);
  const [isSupportView, setIsSupportView] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [adminSection, setAdminSection] = useState<'dashboard' | 'games' | 'users'>('dashboard');
  const [editingGame, setEditingGame] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [gameFormData, setGameFormData] = useState({
    title: '',
    category: 'Action',
    price: 0,
    thumbnail: '',
    description: '',
    platform: 'PC',
    downloadUrl: ''
  });
  const [faqs, setFaqs] = useState<any[]>([]);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [wishlist, setWishlist] = useState<Game[]>([]);
  const [isWishlistView, setIsWishlistView] = useState(false);
  const [gameRating, setGameRating] = useState<{ average: number, count: number, userScore: number | null, reviews: any[] }>({ average: 0, count: 0, userScore: null, reviews: [] });
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewScore, setReviewScore] = useState(5);
  const [ownedGames, setOwnedGames] = useState<Game[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [forumCategories, setForumCategories] = useState<any[]>([]);
  const [isForumView, setIsForumView] = useState(false);
  const [selectedForumCategory, setSelectedForumCategory] = useState<any>(null);
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newPostData, setNewPostData] = useState({ title: '', content: '' });
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  // Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authFormData, setAuthFormData] = useState({ email: '', password: '', username: '' });
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  // Firestore Error Handler
  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errorInfo = {
      error: error.message,
      operation,
      path,
      auth: auth.currentUser?.uid || 'anonymous'
    };
    console.error('Firestore Error:', JSON.stringify(errorInfo));
    alert(`Lỗi hệ thống: ${error.message}`);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        setActiveUserId(user.uid);
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setCurrentUser({ id: user.uid, ...userDoc.data() });
          } else {
            // If user exists in Auth but not Firestore (e.g. initial set up)
            setCurrentUser({ id: user.uid, email: user.email, role: 'USER' });
          }
        } catch (err) {
          console.error("Profile fetch error", err);
        }
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setActiveUserId(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchGames();
    fetchCategories();
    fetchForumCategories();
    fetchFaqs();
  }, [activeCategory, searchTerm]);

  useEffect(() => {
    if (activeUserId) {
      fetchWishlist();
      fetchCart();
      fetchOwnedGames();
      if (currentUser?.role === 'ADMIN') {
        fetchAdminUsers();
        fetchAdminStats();
      }
    } else {
      setWishlist([]);
      setCart([]);
      setOwnedGames([]);
      setAdminUsers([]);
      setAdminStats(null);
    }
  }, [activeUserId, currentUser]);

  const fetchAdminStats = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const gamesSnap = await getDocs(collection(db, "games"));
      const transSnap = await getDocs(collection(db, "transactions"));
      
      const transactions = transSnap.docs.map(d => d.data());
      const gamesData = gamesSnap.docs.map(d => d.data());
      
      const totalRevenue = transactions.reduce((acc, curr: any) => acc + (curr.amount || 0), 0);
      const totalUsers = usersSnap.size;
      const totalGames = gamesSnap.size;
      const totalDownloads = gamesData.reduce((acc, curr: any) => acc + (curr.downloadCount || 0), 0);
      
      const salesData = [
        { name: 'Jan', sales: totalRevenue * 0.1 },
        { name: 'Feb', sales: totalRevenue * 0.15 },
        { name: 'Mar', sales: totalRevenue * 0.25 },
        { name: 'Apr', sales: totalRevenue * 0.5 },
      ];

      setAdminStats({
        totalRevenue,
        totalUsers,
        totalGames,
        totalDownloads,
        salesData
      });
    } catch (err: any) {
      handleFirestoreError(err, 'get', 'admin/stats');
    }
  };

  const fetchOwnedGames = async () => {
    if (!activeUserId) return;
    try {
      const q = query(collection(db, "ownedGames"), where("userId", "==", activeUserId));
      const snapshot = await getDocs(q);
      const ownedIds = snapshot.docs.map(d => d.data().gameId);
      
      const ownedDetailed = [];
      for (const gameId of ownedIds) {
        const gameSnap = await getDoc(doc(db, "games", gameId));
        if (gameSnap.exists()) {
          ownedDetailed.push({ id: gameSnap.id, ...gameSnap.data() } as Game);
        }
      }
      setOwnedGames(ownedDetailed);
    } catch (err: any) {
      handleFirestoreError(err, 'get', 'ownedGames');
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminUsers(users);
    } catch (err: any) {
      handleFirestoreError(err, 'get', 'admin/users');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      fetchAdminUsers();
    } catch (err: any) {
      handleFirestoreError(err, 'update', `users/${userId}/role`);
    }
  };

  const resetGameForm = () => {
    setGameFormData({
      title: '',
      category: 'Action',
      price: 0,
      thumbnail: '',
      description: '',
      platform: 'PC',
      downloadUrl: ''
    });
    setEditingGame(null);
  };

  const handleSaveGame = async () => {
    try {
      if (editingGame) {
        await updateDoc(doc(db, "games", editingGame.id), gameFormData);
        alert("Cập nhật thành công!");
      } else {
        await addDoc(collection(db, "games"), {
          ...gameFormData,
          downloadCount: 0,
          createdAt: serverTimestamp()
        });
        alert("Thêm game thành công!");
      }
      resetGameForm();
      fetchGames();
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'games');
    }
  };

  const handleDeleteGame = async (id: string) => {
    if (!confirm("Xác nhận xóa game này?")) return;
    try {
      await deleteDoc(doc(db, "games", id));
      fetchGames();
    } catch (err: any) {
      handleFirestoreError(err, 'delete', `games/${id}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, authFormData.email, authFormData.password);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.error("Login failed", err);
      alert("Sai email hoặc mật khẩu");
    }
  };

  const handleRegister = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, authFormData.email, authFormData.password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: authFormData.email,
        username: authFormData.username,
        role: "USER",
        createdAt: serverTimestamp()
      });

      setAuthMode('login');
      alert("Đăng ký thành công! Vui lòng đăng nhập.");
    } catch (err: any) {
      console.error("Registration failed", err);
      alert("Đăng ký thất bại: " + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleDownloadGame = async (gameId: string) => {
    if (!activeUserId) return;
    try {
      const q = query(collection(db, "ownedGames"), where("userId", "==", activeUserId), where("gameId", "==", gameId));
      const ownedSnap = await getDocs(q);
      
      if (ownedSnap.empty) {
        alert("Bạn cần mua game này trước khi tải!");
        return;
      }

      const gameSnap = await getDoc(doc(db, "games", gameId));
      if (!gameSnap.exists()) return;

      const game = gameSnap.data();
      await updateDoc(doc(db, "games", gameId), { downloadCount: increment(1) });

      // Generate a fake secure link for local/demo purposes
      const token = Math.random().toString(36).substring(7);
      const secureUrl = `${game.downloadUrl}?token=${token}&expires=${Date.now() + 600000}`;
      
      window.open(secureUrl, '_blank');
      fetchGames(); 
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'download');
    }
  };

  const fetchForumCategories = async () => {
    // Keep internal categories or move to Firestore
    setForumCategories([
      { id: "1", name: "Thông báo", description: "Cập nhật tin tức mới nhất từ hệ thống", icon: "Bell" },
      { id: "2", name: "Hỗ trợ kỹ thuật", description: "Giải đáp các lỗi game và cài đặt", icon: "Wrench" },
      { id: "3", name: "Thảo luận chung", description: "Nơi giao lưu, kết bạn của cộng đồng game thủ", icon: "Users" },
      { id: "4", name: "Góp ý & Báo lỗi", description: "Gửi ý kiến đóng góp của bạn", icon: "MessageSquare" }
    ]);
  };

  const fetchFaqs = async () => {
    try {
      const res = await fetch('/api/support/faqs');
      const data = await res.json();
      setFaqs(data);
    } catch (err) {
      console.error("Failed to fetch FAQs", err);
    }
  };

  const handleContactSubmit = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      const data = await res.json();
      alert(data.message);
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error("Contact failed", err);
    }
  };

  const fetchPosts = async (categoryId: string | number) => {
    try {
      const q = query(collection(db, "forumPosts"), where("categoryId", "==", categoryId.toString()));
      const snapshot = await getDocs(q);
      setForumPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      handleFirestoreError(err, 'get', `forumPosts/${categoryId}`);
    }
  };

  const fetchPostDetail = async (postId: string | number) => {
    try {
      const postRef = doc(db, "forumPosts", postId.toString());
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        await updateDoc(postRef, { views: increment(1) });
        setSelectedPost({ id: postSnap.id, ...postSnap.data() });
        fetchComments(postId);
      }
    } catch (err: any) {
      handleFirestoreError(err, 'get', `forumPosts/${postId}`);
    }
  };

  const fetchComments = async (postId: string | number) => {
    try {
      const q = query(collection(db, "forumComments"), where("postId", "==", postId.toString()));
      const snapshot = await getDocs(q);
      setPostComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      handleFirestoreError(err, 'get', `forumComments/${postId}`);
    }
  };

  const handleCreatePost = async () => {
    if (!activeUserId) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!newPostData.title || !newPostData.content || !selectedForumCategory) return;
    try {
      await addDoc(collection(db, "forumPosts"), {
        userId: activeUserId,
        categoryId: selectedForumCategory.id.toString(),
        title: newPostData.title,
        content: newPostData.content,
        createdAt: serverTimestamp(),
        views: 0,
        user: { id: activeUserId, username: currentUser?.username }
      });
      setNewPostData({ title: '', content: '' });
      setIsCreatingPost(false);
      fetchPosts(selectedForumCategory.id);
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'forumPosts');
    }
  };

  const handleCreateComment = async () => {
    if (!activeUserId) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!newCommentText || !selectedPost) return;
    try {
      await addDoc(collection(db, "forumComments"), {
        userId: activeUserId,
        postId: selectedPost.id.toString(),
        content: newCommentText,
        createdAt: serverTimestamp(),
        user: { id: activeUserId, username: currentUser?.username }
      });
      setNewCommentText('');
      fetchComments(selectedPost.id);
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'forumComments');
    }
  };

  useEffect(() => {
    if (selectedGame) {
      fetchRelatedGames(selectedGame.id);
      fetchGameRating(selectedGame.id);
    }
  }, [selectedGame]);

  const fetchGameRating = async (gameId: string) => {
    try {
      const q = query(collection(db, "ratings"), where("gameId", "==", gameId));
      const snapshot = await getDocs(q);
      const gameRatings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const average = gameRatings.length > 0 
        ? gameRatings.reduce((acc, curr: any) => acc + curr.score, 0) / gameRatings.length 
        : 0;
      
      setGameRating({
        average: parseFloat(average.toFixed(1)),
        count: gameRatings.length,
        userScore: gameRatings.find((r: any) => r.userId === activeUserId)?.score || null,
        reviews: gameRatings || []
      });
    } catch (err: any) {
      handleFirestoreError(err, 'get', `ratings/${gameId}`);
    }
  };

  const fetchCart = async () => {
    if (!activeUserId) return;
    try {
      const q = query(collection(db, "cart"), where("userId", "==", activeUserId));
      const snapshot = await getDocs(q);
      const cartItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const detailedCart = [];
      for (const item of cartItems as any) {
        const gameSnap = await getDoc(doc(db, "games", item.gameId));
        detailedCart.push({
          ...item,
          game: gameSnap.exists() ? { id: gameSnap.id, ...gameSnap.data() } : null
        });
      }
      setCart(detailedCart);
    } catch (err: any) {
      handleFirestoreError(err, 'get', 'cart');
    }
  };

  const addToCart = async (gameId: string) => {
    if (!activeUserId) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      const q = query(collection(db, "cart"), where("userId", "==", activeUserId), where("gameId", "==", gameId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        await updateDoc(doc(db, "cart", snapshot.docs[0].id), { quantity: increment(1) });
      } else {
        await addDoc(collection(db, "cart"), { userId: activeUserId, gameId, quantity: 1 });
      }
      fetchCart();
      setIsCartOpen(true);
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'cart');
    }
  };

  const updateCartQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    try {
      await updateDoc(doc(db, "cart", itemId), { quantity });
      fetchCart();
    } catch (err: any) {
      handleFirestoreError(err, 'update', `cart/${itemId}`);
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "cart", itemId));
      fetchCart();
    } catch (err: any) {
      handleFirestoreError(err, 'delete', `cart/${itemId}`);
    }
  };

  const handleCheckout = async () => {
    if (!activeUserId) return;
    setIsCheckoutProcessing(true);
    try {
      const q = query(collection(db, "cart"), where("userId", "==", activeUserId));
      const cartSnap = await getDocs(q);
      
      let totalAmount = 0;
      for (const cartDoc of cartSnap.docs) {
        const item = cartDoc.data();
        const gameSnap = await getDoc(doc(db, "games", item.gameId));
        if (gameSnap.exists()) {
          totalAmount += (gameSnap.data().price || 0) * item.quantity;
          
          // Check if already owned
          const ownedQuery = query(collection(db, "ownedGames"), where("userId", "==", activeUserId), where("gameId", "==", item.gameId));
          const ownedSnap = await getDocs(ownedQuery);
          if (ownedSnap.empty) {
            await addDoc(collection(db, "ownedGames"), {
              userId: activeUserId,
              gameId: item.gameId,
              purchaseDate: serverTimestamp()
            });
          }
        }
        await deleteDoc(doc(db, "cart", cartDoc.id));
      }

      await addDoc(collection(db, "transactions"), {
        userId: activeUserId,
        amount: totalAmount,
        date: serverTimestamp(),
        type: 'PAYMENT'
      });

      setCart([]);
      setIsCartOpen(false);
      fetchOwnedGames(); 
      alert("Thanh toán thành công! Trò chơi đã được thêm vào thư viện của bạn.");
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'checkout');
    } finally {
      setIsCheckoutProcessing(false);
    }
  };

  const submitRating = async (gameId: string) => {
    if (!activeUserId) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!reviewComment.trim()) {
      alert("Vui lòng nhập nội dung đánh giá");
      return;
    }
    setIsRatingSubmitting(true);
    try {
      const q = query(collection(db, "ratings"), where("userId", "==", activeUserId), where("gameId", "==", gameId));
      const snapshot = await getDocs(q);
      
      const username = currentUser?.username || "Unknown User";

      if (!snapshot.empty) {
        await updateDoc(doc(db, "ratings", snapshot.docs[0].id), { 
          score: reviewScore, 
          comment: reviewComment, 
          updatedAt: serverTimestamp() 
        });
      } else {
        await addDoc(collection(db, "ratings"), { 
          userId: activeUserId, 
          gameId, 
          score: reviewScore, 
          comment: reviewComment, 
          username, 
          createdAt: serverTimestamp() 
        });
      }
      setReviewComment('');
      fetchGameRating(gameId);
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'ratings');
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  const fetchWishlist = async () => {
    if (!activeUserId) return;
    try {
      const q = query(collection(db, "wishlist"), where("userId", "==", activeUserId));
      const snapshot = await getDocs(q);
      const gameIds = snapshot.docs.map(d => d.data().gameId);
      
      const wishlistGames = [];
      for (const gameId of gameIds) {
        const gameSnap = await getDoc(doc(db, "games", gameId));
        if (gameSnap.exists()) {
          wishlistGames.push({ id: gameSnap.id, ...gameSnap.data() } as Game);
        }
      }
      setWishlist(wishlistGames);
    } catch (err: any) {
      handleFirestoreError(err, 'get', 'wishlist');
    }
  };

  const toggleWishlist = async (gameId: string) => {
    if (!activeUserId) {
      setIsAuthModalOpen(true);
      return;
    }
    const isCurrentlyWishlisted = wishlist.some(g => g.id === gameId);
    try {
      if (isCurrentlyWishlisted) {
        const q = query(collection(db, "wishlist"), where("userId", "==", activeUserId), where("gameId", "==", gameId));
        const snapshot = await getDocs(q);
        for (const d of snapshot.docs) {
          await deleteDoc(doc(db, "wishlist", d.id));
        }
      } else {
        await addDoc(collection(db, "wishlist"), { userId: activeUserId, gameId });
      }
      fetchWishlist();
    } catch (err: any) {
      handleFirestoreError(err, 'write', 'wishlist');
    }
  };

  const fetchCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, "games"));
      const gamesData = snapshot.docs.map(doc => doc.data());
      const uniqueCategoryNames = [...new Set(gamesData.map((g: any) => g.category))].filter(Boolean);
      
      const categoryMetadata: Record<string, any> = {
        "Action": { description: "Thế giới của những trận chiến kịch tính và tốc độ cao.", thumbnail: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80&w=600", icon: "Gamepad2" },
        "RPG": { description: "Hóa thân vào nhân vật và khám phá những câu chuyện sử thi.", thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600", icon: "Users" },
        "Strategy": { description: "Thử thách trí tuệ với những kế hoạch tác chiến đỉnh cao.", thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600", icon: "Wrench" },
        "Racing": { description: "Chinh phục những cung đường và tốc độ xé gió.", thumbnail: "https://images.unsplash.com/photo-1532906130829-183fa0f63562?auto=format&fit=crop&q=80&w=600", icon: "Clock" }
      };

      const results = uniqueCategoryNames.map((name: any, index: number) => ({
        id: index + 1,
        name,
        ...(categoryMetadata[name] || { description: "Khám phá các tựa game hấp dẫn thuộc thể loại này.", thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b25272a7?auto=format&fit=crop&q=80&w=600", icon: "Gamepad2" })
      }));
      setCategories(results as Category[]);
    } catch (err: any) {
      handleFirestoreError(err, 'get', 'categories');
    }
  };

  const fetchGames = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "games"));
      let gamesList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Game));

      if (activeCategory !== 'All') {
        gamesList = gamesList.filter(g => g.category?.toLowerCase() === activeCategory.toLowerCase());
      }
      if (searchTerm) {
        gamesList = gamesList.filter(g => g.title?.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      
      setGames(gamesList);
    } catch (err: any) {
      handleFirestoreError(err, 'get', 'games');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedGames = async (gameId: string) => {
    try {
      const gameSnap = await getDoc(doc(db, "games", gameId));
      if (!gameSnap.exists()) return;
      
      const gameData = gameSnap.data();
      const q = query(collection(db, "games"), where("category", "==", gameData.category));
      const snapshot = await getDocs(q);
      const related = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Game))
        .filter(d => d.id !== gameId)
        .slice(0, 4);
      
      setRelatedGames(related);
    } catch (err: any) {
      handleFirestoreError(err, 'get', `games/${gameId}/related`);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const gameRef = doc(db, "games", id);
      await updateDoc(gameRef, { downloadCount: increment(1) });
      const updatedSnap = await getDoc(gameRef);
      const data = updatedSnap.data();
      
      alert(`Đang chuẩn bị tải xuống: ${data?.downloadUrl}. Lượt tải mới: ${data?.downloadCount}`);
      fetchGames(); 
    } catch (err: any) {
      handleFirestoreError(err, 'update', `games/${id}/download`);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toUpperCase();
    if (p.includes('WINDOWS')) return <Monitor size={12} />;
    if (p.includes('MACOS')) return <Laptop size={12} />;
    if (p.includes('LINUX')) return <Monitor size={12} />;
    return <Gamepad2 size={12} />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0c] text-gray-100 font-sans overflow-x-hidden">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-[80%] bg-[#0d0d0f] p-8 border-l border-white/10 flex flex-col gap-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-cyan-400">MENU</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-white/5 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-6 text-sm font-black tracking-widest uppercase text-gray-400">
                <button 
                  onClick={() => {setSelectedGame(null); setActiveCategory('All'); setIsWishlistView(false); setIsForumView(false); setIsCategoryView(false); setIsSupportView(false); setIsAdminView(false); setIsMobileMenuOpen(false);}}
                  className={!selectedGame && !isForumView && !isCategoryView && !isSupportView && !isAdminView && activeCategory === 'All' && !isWishlistView ? 'text-cyan-400' : 'hover:text-white'}
                >
                  TRANG CHỦ
                </button>
                <button 
                  onClick={() => {setSelectedGame(null); setIsWishlistView(true); setIsForumView(false); setIsCategoryView(false); setIsSupportView(false); setIsAdminView(false); setIsMobileMenuOpen(false);}}
                  className={isWishlistView ? 'text-cyan-400' : 'hover:text-white'}
                >
                  YÊU THÍCH
                </button>
                <button 
                  onClick={() => {setSelectedGame(null); setIsForumView(true); setIsWishlistView(false); setIsCategoryView(false); setIsSupportView(false); setIsAdminView(false); setIsMobileMenuOpen(false);}}
                  className={isForumView ? 'text-cyan-400' : 'hover:text-white'}
                >
                  DIỄN ĐÀN
                </button>
                <button 
                  onClick={() => {setSelectedGame(null); setIsCategoryView(true); setIsWishlistView(false); setIsForumView(false); setIsSupportView(false); setIsAdminView(false); setIsMobileMenuOpen(false);}}
                  className={isCategoryView ? 'text-cyan-400' : 'hover:text-white'}
                >
                  DANH MỤC
                </button>
                <button 
                  onClick={() => {setSelectedGame(null); setIsSupportView(true); setIsCategoryView(false); setIsWishlistView(false); setIsForumView(false); setIsAdminView(false); setIsMobileMenuOpen(false);}}
                  className={isSupportView ? 'text-cyan-400' : 'hover:text-white'}
                >
                  HỖ TRỢ
                </button>
                {currentUser?.role === 'ADMIN' && (
                  <button 
                    onClick={() => {setSelectedGame(null); setIsAdminView(true); setIsSupportView(false); setIsCategoryView(false); setIsWishlistView(false); setIsForumView(false); setIsMobileMenuOpen(false);}}
                    className={isAdminView ? 'text-cyan-400' : 'hover:text-white'}
                  >
                    QUẢN TRỊ
                  </button>
                )}
              </div>

              <div className="mt-auto flex flex-col gap-4">
                <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Thể loại</h3>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setActiveCategory(cat.name); setIsMobileMenuOpen(false); }}
                      className={`p-3 rounded-xl border ${activeCategory === cat.name ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400' : 'border-white/5 bg-white/5 text-gray-500'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Navigation */}
      <nav className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-8 bg-[#0d0d0f]/80 backdrop-blur-xl shrink-0 sticky top-0 z-[60]">
        <div className="flex items-center gap-10">
          <div 
            className="text-2xl font-black tracking-tighter text-cyan-400 cursor-pointer flex items-center gap-2"
            onClick={() => {setSelectedGame(null); setActiveCategory('All'); setIsWishlistView(false); setIsForumView(false); setIsCategoryView(false); setIsSupportView(false); setIsAdminView(false);}}
          >
            NEXUS<span className="text-white">GAMES</span>
          </div>
          <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold tracking-widest text-gray-400">
            <button 
                onClick={() => {setSelectedGame(null); setActiveCategory('All'); setIsWishlistView(false); setIsForumView(false); setIsCategoryView(false); setIsSupportView(false); setIsAdminView(false);}}
                className={`transition-colors uppercase ${!selectedGame && !isForumView && !isCategoryView && !isSupportView && !isAdminView && activeCategory === 'All' && !isWishlistView ? 'text-cyan-400' : 'hover:text-white'}`}
            >
                TRANG CHỦ
            </button>
            <button 
                onClick={() => {setSelectedGame(null); setIsWishlistView(true); setIsForumView(false); setIsCategoryView(false); setIsSupportView(false); setIsAdminView(false);}}
                className={`transition-colors uppercase ${isWishlistView ? 'text-cyan-400' : 'hover:text-white'}`}
            >
                YÊU THÍCH
            </button>
            <button 
                onClick={() => {setSelectedGame(null); setIsForumView(true); setIsWishlistView(false); setIsCategoryView(false); setIsSupportView(false); setIsAdminView(false);}}
                className={`transition-colors uppercase ${isForumView ? 'text-cyan-400' : 'hover:text-white'}`}
            >
                DIỄN ĐÀN
            </button>
            <button 
                onClick={() => {setSelectedGame(null); setIsCategoryView(true); setIsWishlistView(false); setIsForumView(false); setIsSupportView(false); setIsAdminView(false);}}
                className={`transition-colors uppercase ${isCategoryView ? 'text-cyan-400' : 'hover:text-white'}`}
            >
                DANH MỤC
            </button>
            <button 
                onClick={() => {setSelectedGame(null); setIsSupportView(true); setIsCategoryView(false); setIsWishlistView(false); setIsForumView(false); setIsAdminView(false);}}
                className={`transition-colors uppercase ${isSupportView ? 'text-cyan-400' : 'hover:text-white'}`}
            >
                HỖ TRỢ
            </button>
            {currentUser?.role === 'ADMIN' && (
              <button 
                  onClick={() => {setSelectedGame(null); setIsAdminView(true); setIsSupportView(false); setIsCategoryView(false); setIsWishlistView(false); setIsForumView(false);}}
                  className={`transition-colors uppercase flex items-center gap-1.5 ${isAdminView ? 'text-cyan-400' : 'hover:text-cyan-500/50 hover:text-white'}`}
              >
                  <ShieldCheck size={14} /> QUẢN TRỊ
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="TÌM KIẾM TRÒ CHƠI..." 
              className="bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-[10px] font-bold tracking-widest w-72 focus:outline-none focus:border-cyan-500/50 transition-all uppercase"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div 
              className={`p-2.5 rounded-xl cursor-pointer transition-all border ${isWishlistView ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'}`}
              onClick={() => { setIsWishlistView(!isWishlistView); setIsForumView(false); setIsCategoryView(false); setIsSupportView(false); setIsAdminView(false); setSelectedGame(null); }}
            >
              <Heart size={18} fill={isWishlistView ? "currentColor" : "none"} />
            </div>
            
            <div 
              className="p-2.5 rounded-xl cursor-pointer transition-all border bg-white/5 border-white/5 text-gray-400 hover:text-white relative"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingBag size={18} />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 text-black text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#0d0d0f]">
                  {cart.reduce((acc, curr) => acc + curr.quantity, 0)}
                </span>
              )}
            </div>

            <button 
              className="lg:hidden p-2.5 bg-white/5 border border-white/5 rounded-xl text-gray-400"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>

            {isLoggedIn ? (
              <div className="flex items-center gap-3 pl-3 border-l border-white/10">
                <div className="flex flex-col items-end hidden md:flex">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{currentUser?.username}</span>
                  <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-tighter">PREMIUM</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 bg-white/5 border border-white/5 rounded-xl hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 transition-all text-gray-400"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="hidden md:block text-[10px] font-black tracking-widest bg-white text-black px-8 py-3 rounded-xl hover:bg-cyan-400 transition-all transform active:scale-95 shadow-lg shadow-white/5 uppercase"
              >
                ĐĂNG NHẬP
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Categories */}
        {!selectedGame && !isCategoryView && (
          <aside className="w-64 border-r border-white/5 p-8 flex flex-col gap-10 bg-[#0d0d0f]/50 shrink-0 overflow-y-auto hidden md:flex">
            <div>
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6">Thể Loại</h3>
              <ul className="space-y-1 text-sm font-medium text-gray-400">
                <li 
                    onClick={() => setActiveCategory('All')}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                      activeCategory === 'All' 
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' 
                      : 'hover:bg-white/5 hover:text-white'
                    }`}
                >
                    <span>Tất cả</span>
                    {activeCategory === 'All' && <div className="w-1 h-1 bg-cyan-400 rounded-full" />}
                </li>
                {categories.map(cat => (
                  <li 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                      activeCategory === cat.name 
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' 
                      : 'hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{cat.name}</span>
                    {activeCategory === cat.name && <div className="w-1 h-1 bg-cyan-400 rounded-full" />}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-auto pt-6 border-t border-white/5">
                <p className="text-[10px] text-gray-600 font-bold leading-relaxed">
                    Hệ thống phân phối kỹ thuật số bảo mật cao cấp.
                </p>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto overflow-x-hidden flex flex-col gap-10">
          <AnimatePresence mode="wait">
            {selectedGame ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-5xl mx-auto w-full flex flex-col gap-10"
              >
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => setSelectedGame(null)}
                        className="flex items-center gap-2 text-[10px] font-black tracking-widest text-gray-500 hover:text-white transition-colors"
                    >
                        <ChevronRight className="w-3 h-3 rotate-180" /> QUAY LẠI
                    </button>
                    <div className="flex gap-4">
                        <span className="text-[9px] bg-white/5 border border-white/10 px-3 py-1 rounded-full font-bold opacity-50">#OFFICIAL_RELEASE</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    <div className="aspect-video relative rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                      <img src={selectedGame.coverImage || selectedGame.thumbnail} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] to-transparent" />
                    </div>
                    
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">{selectedGame.title}</h1>
                        <div className="flex flex-wrap gap-3 text-[10px] font-black tracking-widest mb-8">
                            <span className="flex items-center gap-2 border border-cyan-400/20 px-3 py-1.5 rounded bg-cyan-400/5 text-cyan-400 uppercase">
                              <Gamepad2 size={12} /> {selectedGame.category}
                            </span>
                            <span className="flex items-center gap-2 border border-yellow-500/20 px-3 py-1.5 rounded bg-yellow-500/5 text-yellow-500 uppercase">
                              <Star size={12} className="fill-yellow-500" /> {gameRating.average.toFixed(1)} ({gameRating.count} đánh giá)
                            </span>
                            <span className="border border-white/10 px-3 py-1.5 rounded bg-white/5 text-gray-400 uppercase">
                              {selectedGame.version || 'v1.0.0'}
                            </span>
                            <span className="border border-white/10 px-3 py-1.5 rounded bg-white/5 text-gray-400 uppercase">
                              {selectedGame.fileSize || 'N/A'}
                            </span>
                        </div>
                        
                        <div className="flex flex-col gap-6">
                            <div className="bg-white/5 p-8 rounded-2xl border border-white/5 backdrop-blur-md">
                                <h3 className="text-[11px] font-black tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-3 uppercase">
                                    <Gamepad2 className="w-4 h-4 text-cyan-400" /> Giới thiệu trò chơi
                                </h3>
                                <p className="text-gray-400 text-sm leading-relaxed italic font-light">
                                    {selectedGame.fullDesc || selectedGame.shortDesc}
                                </p>
                            </div>
                        </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="bg-[#0d0d0f] p-8 rounded-2xl border border-white/10 sticky top-24 flex flex-col gap-6">
                        <div className="relative group overflow-hidden rounded-xl border border-white/5">
                          <img src={selectedGame.thumbnail} className="w-full aspect-square object-cover transition-transform duration-700 group-hover:scale-110" />
                          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-lg border border-white/10">
                            <span className="text-xl font-black text-white italic tracking-tighter">${selectedGame.price}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          {ownedGames.some(og => og.id === selectedGame.id) ? (
                            <button 
                                onClick={() => handleDownloadGame(selectedGame.id)}
                                className="w-full bg-cyan-500 text-black font-black text-[12px] tracking-[0.2em] py-5 rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-cyan-400 active:scale-95 shadow-xl shadow-cyan-500/20 group"
                            >
                                <Download className="w-5 h-5" />
                                TẢI XUỐNG IPA / CÀI ĐẶT
                            </button>
                          ) : (
                            <button 
                                onClick={() => addToCart(selectedGame.id)}
                                className="w-full bg-white text-black font-black text-[12px] tracking-[0.2em] py-5 rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-cyan-400 active:scale-95 shadow-xl shadow-white/10 group"
                            >
                                <ShoppingBag className="w-5 h-5" />
                                THÊM VÀO GIỎ HÀNG
                            </button>
                          )}

                          {!isLoggedIn && (
                            <button 
                              onClick={() => setIsAuthModalOpen(true)}
                              className="w-full bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 font-black text-[12px] tracking-widest py-5 rounded-xl flex items-center justify-center gap-3 transition-all"
                            >
                              <Download size={18} /> ĐĂNG NHẬP ĐỂ TẢI
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                          <p className="text-[10px] text-gray-600 font-bold tracking-widest uppercase flex items-center gap-2">
                             <ShieldCheck size={12} className="text-green-500/50" /> Thanh toán an toàn và bảo mật
                          </p>
                          <p className="text-[10px] text-gray-600 font-bold tracking-widest uppercase flex items-center gap-2">
                             <Clock size={12} className="text-cyan-500/50" /> Tải về ngay lập tức sau khi kích hoạt
                          </p>
                        </div>
                    </div>
                  </div>

                  {/* Reviews Section */}
                  <div className="mt-16 sm:mt-24 pt-16 sm:pt-24 border-t border-white/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12 sm:mb-16">
                      <div className="flex flex-col gap-3">
                        <h3 className="text-3xl sm:text-4xl font-black tracking-tighter text-white italic uppercase">ĐÁNH GIÁ <span className="text-cyan-400">TỪ CỘNG ĐỒNG</span></h3>
                        <div className="flex items-center gap-3">
                           <div className="flex items-center gap-1 text-yellow-400">
                             {[...Array(5)].map((_, i) => <Star key={i} size={16} fill={i < Math.round(gameRating.average) ? "currentColor" : "none"} className={i < Math.round(gameRating.average) ? "" : "text-gray-700"} />)}
                           </div>
                           <span className="text-xs font-black text-white">{gameRating.average.toFixed(1)} / 5</span>
                           <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">• {gameRating.count} lượt đánh giá</span>
                        </div>
                      </div>

                      {ownedGames.some(og => og.id === selectedGame.id) && (
                        <div className="flex flex-col gap-4 bg-white/2 p-6 sm:p-8 rounded-[32px] border border-white/5 w-full sm:max-w-md">
                           <h4 className="text-[10px] font-black text-white tracking-[0.2em] uppercase">GỬI ĐÁNH GIÁ CỦA BẠN</h4>
                           <div className="flex items-center gap-3 justify-center py-2">
                             {[...Array(5)].map((_, i) => (
                               <button 
                                 key={i} 
                                 onClick={() => setReviewScore(i + 1)}
                                 className={`transition-all hover:scale-125 ${i < reviewScore ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'}`}
                               >
                                 <Star size={32} fill={i < reviewScore ? "currentColor" : "none"} />
                               </button>
                             ))}
                           </div>
                           <textarea 
                             placeholder="CHIA SẺ TRẢI NGHIỆM CỦA BẠN VỀ GAME NÀY..." 
                             rows={3}
                             className="bg-black/40 border border-white/10 rounded-2xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase resize-none w-full"
                             value={reviewComment}
                             onChange={e => setReviewComment(e.target.value)}
                           />
                           <button 
                             onClick={() => submitRating(selectedGame.id)}
                             disabled={isRatingSubmitting}
                             className="w-full bg-cyan-500 text-black py-4 rounded-xl text-[10px] font-black tracking-widest hover:bg-cyan-400 transition-all uppercase disabled:opacity-50"
                           >
                             {isRatingSubmitting ? 'ĐANG GỬI...' : 'XÁC NHẬN ĐÁNH GIÁ'}
                           </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                       {gameRating.reviews.length > 0 ? gameRating.reviews.map((review: any) => (
                         <motion.div 
                           key={review.id}
                           initial={{ opacity: 0, scale: 0.95 }}
                           whileInView={{ opacity: 1, scale: 1 }}
                           viewport={{ once: true }}
                           className="bg-[#16161a] p-8 rounded-[32px] border border-white/5 flex flex-col gap-6"
                         >
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400 text-xs font-black uppercase">
                                     {review.username?.charAt(0) || 'U'}
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[11px] font-black text-white uppercase tracking-wider">{review.username}</span>
                                     <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest italic">Người sở hữu game</span>
                                  </div>
                               </div>
                               <div className="flex items-center gap-1 text-yellow-400">
                                  {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < review.score ? "currentColor" : "none"} className={i < review.score ? "" : "text-gray-800"} />)}
                               </div>
                            </div>
                            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                               "{review.comment || 'Không có bình luận nào.'}"
                            </p>
                            <div className="flex items-center gap-4 pt-2 border-t border-white/2">
                               <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest">Đăng vào tháng 5, 2024</span>
                            </div>
                         </motion.div>
                       )) : (
                         <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed border-white/5 rounded-[40px]">
                            <MessageSquare size={48} className="text-gray-800" />
                            <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.2em]">Chưa có đánh giá nào cho siêu phẩm này</p>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : isCategoryView ? (
              <motion.div 
                key="categories"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-2">
                  <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">DANH MỤC <span className="text-cyan-400">TRÒ CHƠI</span></h2>
                  <p className="text-gray-500 text-[11px] font-bold tracking-widest uppercase">Khám phá vũ trụ game theo phong cách của bạn</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
                  {categories.map(cat => {
                    const Icon = cat.icon === 'Users' ? Users : cat.icon === 'Wrench' ? Wrench : cat.icon === 'Clock' ? Clock : Gamepad2;
                    return (
                      <motion.div 
                        key={cat.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => { setActiveCategory(cat.name); setIsCategoryView(false); }}
                        className="relative h-56 md:h-64 rounded-3xl overflow-hidden border border-white/5 cursor-pointer group"
                      >
                        <img src={cat.thumbnail} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        <div className="relative h-full p-8 md:p-10 flex flex-col justify-end gap-2 md:gap-3">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-cyan-500/20 backdrop-blur-xl border border-cyan-500/30 rounded-2xl flex items-center justify-center text-cyan-400 mb-1 md:mb-2">
                             <Icon size={20} className="md:w-6 md:h-6" />
                          </div>
                          <h3 className="text-2xl md:text-3xl font-black tracking-tighter text-white uppercase italic">{cat.name}</h3>
                          <p className="text-gray-400 text-[10px] md:text-xs font-bold leading-relaxed tracking-wider uppercase max-w-xs">{cat.description}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            ) : isForumView ? (
              <motion.div 
                key="forum"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-2">
                  <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">DIỄN ĐÀN <span className="text-cyan-400">HỖ TRỢ</span></h2>
                  <p className="text-gray-500 text-[11px] font-bold tracking-widest uppercase">Nơi giải đáp thắc mắc và kết nối cộng đồng game thủ</p>
                </div>

                {!selectedForumCategory ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {forumCategories.map(cat => {
                      const Icon = cat.icon === 'Bell' ? Bell : cat.icon === 'Wrench' ? Wrench : cat.icon === 'Users' ? Users : MessageSquare;
                      return (
                        <motion.div 
                          key={cat.id}
                          whileHover={{ y: -5, borderColor: 'rgba(34, 211, 238, 0.3)' }}
                          onClick={() => { setSelectedForumCategory(cat); fetchPosts(cat.id); }}
                          className="bg-[#16161a] p-8 rounded-3xl border border-white/5 cursor-pointer transition-all group"
                        >
                          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-gray-400 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-all">
                            <Icon size={24} />
                          </div>
                          <h3 className="text-sm font-black tracking-widest text-white uppercase mb-2">{cat.name}</h3>
                          <p className="text-gray-500 text-[10px] font-bold tracking-wider leading-relaxed uppercase">{cat.description}</p>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : !selectedPost ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4 text-[10px] font-black tracking-widest uppercase">
                        <span className="text-gray-500 cursor-pointer hover:text-white" onClick={() => setSelectedForumCategory(null)}>DIỄN ĐÀN</span>
                        <ChevronRight size={12} className="text-gray-700" />
                        <span className="text-cyan-400">{selectedForumCategory.name}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">{selectedForumCategory.name}</h3>
                        <button 
                          onClick={() => setIsCreatingPost(true)}
                          className="w-full sm:w-auto px-6 py-3 bg-white text-black text-[10px] font-black tracking-widest rounded-xl hover:bg-cyan-400 transition-all uppercase"
                        >
                          TẠO BÀI VIẾT MỚI
                        </button>
                    </div>

                    {isCreatingPost && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-[#16161a] p-8 rounded-3xl border border-cyan-500/30 flex flex-col gap-6"
                        >
                          <input 
                            placeholder="TIÊU ĐỀ BÀI VIẾT..." 
                            className="bg-black/40 border border-white/5 rounded-xl p-4 text-xs font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase"
                            value={newPostData.title}
                            onChange={e => setNewPostData({...newPostData, title: e.target.value})}
                          />
                          <textarea 
                            placeholder="NỘI DUNG CHI TIẾT..." 
                            rows={5}
                            className="bg-black/40 border border-white/5 rounded-xl p-4 text-xs font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase resize-none"
                            value={newPostData.content}
                            onChange={e => setNewPostData({...newPostData, content: e.target.value})}
                          />
                          <div className="flex gap-4">
                              <button 
                                onClick={handleCreatePost}
                                className="bg-cyan-500 px-8 py-3 rounded-xl text-black text-[10px] font-black tracking-widest hover:bg-cyan-400 transition-all"
                              >
                                XÁC NHẬN ĐĂNG
                              </button>
                              <button 
                                onClick={() => setIsCreatingPost(false)}
                                className="bg-white/5 px-8 py-3 rounded-xl text-white text-[10px] font-black tracking-widest hover:bg-white/10 transition-all"
                              >
                                HỦY BỎ
                              </button>
                          </div>
                        </motion.div>
                    )}

                    <div className="flex flex-col gap-4">
                        {forumPosts.map(post => (
                          <div 
                            key={post.id}
                            onClick={() => fetchPostDetail(post.id)}
                            className="bg-[#16161a] p-6 rounded-2xl border border-white/5 flex items-center justify-between hover:border-white/20 cursor-pointer transition-all group"
                          >
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-cyan-400 text-xs font-black uppercase">
                                  {post.user?.username?.charAt(0) || 'P'}
                                </div>
                                <div className="flex flex-col">
                                  <h4 className="text-sm font-black tracking-widest text-white uppercase">{post.title}</h4>
                                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Đăng bởi: {post.user?.username || 'Ẩn danh'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-8 pr-4">
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] font-black text-white">{post.views || 0}</span>
                                  <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Lượt xem</span>
                                </div>
                                <Eye size={16} className="text-gray-700" />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    <div className="flex items-center gap-4 text-[10px] font-black tracking-widest uppercase">
                        <span className="text-gray-500 cursor-pointer hover:text-white" onClick={() => setSelectedForumCategory(null)}>DIỄN ĐÀN</span>
                        <ChevronRight size={12} className="text-gray-700" />
                        <span className="text-gray-500 cursor-pointer hover:text-white" onClick={() => setSelectedPost(null)}>{selectedForumCategory.name}</span>
                        <ChevronRight size={12} className="text-gray-700" />
                        <span className="text-cyan-400">{selectedPost.title}</span>
                    </div>

                    <div className="bg-[#16161a] p-10 rounded-[32px] border border-white/5">
                        <h3 className="text-2xl font-black tracking-tight text-white uppercase mb-4">{selectedPost.title}</h3>
                        <p className="text-gray-400 text-sm font-bold tracking-wider leading-relaxed uppercase">
                          {selectedPost.content}
                        </p>
                    </div>

                    <div className="flex flex-col gap-6 pl-10 border-l-2 border-white/5">
                        <h4 className="text-xs font-black tracking-[0.2em] text-white uppercase italic">THẢO LUẬN ({postComments.length})</h4>
                        {postComments.map(comment => (
                          <div key={comment.id} className="bg-[#0d0d0f] p-6 rounded-2xl border border-white/5 flex flex-col gap-2">
                             <span className="text-[10px] font-black text-white uppercase tracking-widest">{comment.user?.username || 'Người dùng'}</span>
                             <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{comment.content}</p>
                          </div>
                        ))}
                        <div className="flex flex-col gap-4 mt-4">
                          <textarea 
                              placeholder="VIẾT BÌNH LUẬN CỦA BẠN..." 
                              rows={3}
                              className="bg-black/40 border border-white/5 rounded-2xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase resize-none"
                              value={newCommentText}
                              onChange={e => setNewCommentText(e.target.value)}
                          />
                          <button 
                            onClick={handleCreateComment}
                            className="bg-white text-black px-8 py-3 rounded-xl text-[10px] font-black tracking-widest hover:bg-cyan-400 transition-all uppercase"
                          >
                            GỬI PHẢN HỒI
                          </button>
                        </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : isAdminView ? (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-10 w-full"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">QUẢN TRỊ <span className="text-cyan-400">HỆ THỐNG</span></h2>
                    <div className="flex items-center gap-4 mt-2">
                       <button 
                        onClick={() => setAdminSection('dashboard')}
                        className={`text-[10px] font-black tracking-widest px-6 py-2.5 rounded-lg transition-all ${adminSection === 'dashboard' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                       >
                        DASHBOARD
                       </button>
                       <button 
                        onClick={() => setAdminSection('games')}
                        className={`text-[10px] font-black tracking-widest px-6 py-2.5 rounded-lg transition-all ${adminSection === 'games' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                       >
                        KHO GAME
                       </button>
                       <button 
                        onClick={() => setAdminSection('users')}
                        className={`text-[10px] font-black tracking-widest px-6 py-2.5 rounded-lg transition-all ${adminSection === 'users' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                       >
                        NGƯỜI DÙNG
                       </button>
                    </div>
                  </div>
                  {adminSection === 'games' && (
                    <button 
                      onClick={resetGameForm}
                      className="flex items-center gap-2 bg-white/5 border border-white/10 text-white font-black px-6 py-3 rounded-xl hover:bg-cyan-500 hover:text-black transition-all text-xs tracking-widest uppercase"
                    >
                      <PlusCircle size={16} /> THÊM GAME MỚI
                    </button>
                  )}
                </div>

                {adminSection === 'dashboard' ? (
                  <div className="flex flex-col gap-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                       <div className="bg-[#16161a] p-6 rounded-[24px] border border-white/5 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                             <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400"><DollarSign size={20} /></div>
                             <span className="text-[10px] font-black text-green-400 tracking-widest">+12.5%</span>
                          </div>
                          <div>
                             <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Tổng doanh thu</h4>
                             <p className="text-3xl font-black text-white italic">${adminStats?.totalRevenue?.toFixed(2) || '0.00'}</p>
                          </div>
                       </div>
                       <div className="bg-[#16161a] p-6 rounded-[24px] border border-white/5 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                             <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400"><Users size={20} /></div>
                             <span className="text-[10px] font-black text-green-400 tracking-widest">+8.2%</span>
                          </div>
                          <div>
                             <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Người dùng</h4>
                             <p className="text-3xl font-black text-white italic">{adminStats?.totalUsers || '0'}</p>
                          </div>
                       </div>
                       <div className="bg-[#16161a] p-6 rounded-[24px] border border-white/5 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                             <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400"><Package size={20} /></div>
                          </div>
                          <div>
                             <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Sản phẩm</h4>
                             <p className="text-3xl font-black text-white italic">{adminStats?.totalGames || '0'}</p>
                          </div>
                       </div>
                       <div className="bg-[#16161a] p-6 rounded-[24px] border border-white/5 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                             <div className="p-3 bg-red-500/10 rounded-xl text-red-400"><Download size={20} /></div>
                             <span className="text-[10px] font-black text-red-400 tracking-widest">+24%</span>
                          </div>
                          <div>
                             <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Lượt tải</h4>
                             <p className="text-3xl font-black text-white italic">{adminStats?.totalDownloads || '0'}</p>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                       <div className="lg:col-span-2 bg-[#16161a] p-8 rounded-[32px] border border-white/5">
                          <div className="flex items-center justify-between mb-10">
                             <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Biểu đồ tăng trưởng doanh thu</h3>
                             <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-cyan-500 rounded-full" />
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Doanh thu tháng</span>
                             </div>
                          </div>
                          <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                               <AreaChart data={adminStats?.salesData || []}>
                                  <defs>
                                     <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                     </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                  <XAxis 
                                    dataKey="name" 
                                    stroke="#52525b" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tick={{fontWeight: 'bold'}}
                                  />
                                  <YAxis hide />
                                  <Tooltip 
                                    contentStyle={{backgroundColor: '#0d0d0f', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px'}}
                                    itemStyle={{color: '#06b6d4', fontWeight: '900'}}
                                  />
                                  <Area 
                                    type="monotone" 
                                    dataKey="sales" 
                                    stroke="#06b6d4" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorSales)" 
                                  />
                               </AreaChart>
                            </ResponsiveContainer>
                          </div>
                       </div>
                       
                       <div className="bg-[#16161a] p-8 rounded-[32px] border border-white/5 flex flex-col gap-6">
                          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Hoạt động gần đây</h3>
                          <div className="flex flex-col gap-6">
                             {[
                               { user: 'Hà Hoàng', action: 'vừa mua Fiber v2', time: '2 phút trước', color: 'bg-cyan-500' },
                               { user: 'Admin', action: 'cập nhật link IPA Cyber Ninja', time: '15 phút trước', color: 'bg-purple-500' },
                               { user: 'Tài Phạm', action: 'để lại đánh giá 5 sao cho Legend', time: '1 giờ trước', color: 'bg-yellow-500' },
                               { user: 'Linh Trần', action: 'tạo bài viết mới trong Diễn đàn', time: '3 giờ trước', color: 'bg-red-500' }
                             ].map((item, id) => (
                               <div key={id} className="flex gap-4">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${item.color} shrink-0`} />
                                  <div className="flex flex-col gap-0.5">
                                     <p className="text-[11px] font-bold text-gray-300 leading-tight">
                                        <span className="text-white font-black">{item.user}</span> {item.action}
                                     </p>
                                     <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{item.time}</span>
                                  </div>
                               </div>
                             ))}
                          </div>
                          <button className="w-full mt-auto py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all uppercase">
                             Xem tất cả báo cáo
                          </button>
                       </div>
                    </div>
                  </div>
                ) : adminSection === 'games' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-1 bg-[#16161a] border border-white/5 p-8 rounded-3xl h-fit flex flex-col gap-6 sticky top-24">
                      <h3 className="text-xs font-black text-cyan-400 tracking-widest uppercase">{editingGame ? 'CẬP NHẬT GAME' : 'THÊM GAME MỚI'}</h3>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tiêu đề game</label>
                          <input 
                            type="text" 
                            className="bg-white/5 border border-white/5 rounded-xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase"
                            value={gameFormData.title}
                            onChange={e => setGameFormData({...gameFormData, title: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Thể loại</label>
                            <select 
                              className="bg-[#0d0d0f] border border-white/5 rounded-xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase appearance-none"
                              value={gameFormData.category}
                              onChange={e => setGameFormData({...gameFormData, category: e.target.value})}
                            >
                              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Giá ($)</label>
                            <input 
                              type="number" 
                              className="bg-white/5 border border-white/5 rounded-xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all"
                              value={gameFormData.price}
                              onChange={e => setGameFormData({...gameFormData, price: parseFloat(e.target.value)})}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">URL Ảnh bìa</label>
                          <input 
                            type="text" 
                            className="bg-white/5 border border-white/5 rounded-xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all"
                            value={gameFormData.thumbnail}
                            onChange={e => setGameFormData({...gameFormData, thumbnail: e.target.value})}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Link Download (IPA/URL)</label>
                          <input 
                            type="text" 
                            className="bg-white/5 border border-white/5 rounded-xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all"
                            value={gameFormData.downloadUrl}
                            onChange={e => setGameFormData({...gameFormData, downloadUrl: e.target.value})}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Mô tả</label>
                          <textarea 
                            rows={4}
                            className="bg-white/5 border border-white/5 rounded-xl p-4 text-[11px] font-bold leading-relaxed text-white outline-none focus:border-cyan-500 transition-all uppercase resize-none"
                            value={gameFormData.description}
                            onChange={e => setGameFormData({...gameFormData, description: e.target.value})}
                          />
                        </div>
                        <button 
                          onClick={handleSaveGame}
                          className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/20 text-[11px] tracking-widest uppercase flex items-center justify-center gap-2"
                        >
                          <Save size={16} /> {editingGame ? 'CẬP NHẬT' : 'XÁC NHẬN LƯU'}
                        </button>
                        {editingGame && (
                          <button 
                            onClick={resetGameForm}
                            className="w-full bg-white/5 border border-white/10 text-gray-400 font-black py-4 rounded-xl hover:text-white transition-all text-[11px] uppercase"
                          >
                            HỦY BỎ
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-6">
                      <h3 className="text-xs font-black text-gray-500 tracking-widest uppercase">DANH SÁCH GAME HIỆN TẠI</h3>
                      <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/2">
                              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Game</th>
                              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Thể loại</th>
                              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Giá</th>
                              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {games.map(game => (
                              <tr key={game.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                                <td className="p-6">
                                  <div className="flex items-center gap-4">
                                    <img src={game.thumbnail} className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                                    <span className="text-xs font-black text-white uppercase tracking-wider">{game.title}</span>
                                  </div>
                                </td>
                                <td className="p-6">
                                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{game.category}</span>
                                </td>
                                <td className="p-6">
                                  <span className="text-xs font-bold text-gray-400">${game.price}</span>
                                </td>
                                <td className="p-6 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button 
                                      onClick={() => { setEditingGame(game); setGameFormData({ ...game }); }}
                                      className="p-2.5 bg-white/5 border border-white/10 rounded-lg hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-gray-500"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteGame(game.id)}
                                      className="p-2.5 bg-white/5 border border-white/10 rounded-lg hover:border-red-500/50 hover:text-red-500 transition-all text-gray-500"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/2">
                          <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Người dùng</th>
                          <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Email</th>
                          <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Vai trò</th>
                          <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map(user => (
                          <tr key={user.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                            <td className="p-6 text-xs font-black text-white uppercase tracking-wider">{user.username}</td>
                            <td className="p-6 text-xs text-gray-500">{user.email}</td>
                            <td className="p-6">
                              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${user.role === 'ADMIN' ? 'bg-cyan-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="p-6 text-right">
                              <select 
                                className="bg-[#0d0d0f] border border-white/10 rounded-lg p-2 text-[10px] font-black text-white outline-none focus:border-cyan-500 transition-all uppercase"
                                value={user.role}
                                onChange={e => handleUpdateRole(user.id, e.target.value)}
                                disabled={user.id === currentUser?.id}
                              >
                                <option value="USER">GÁN QUYỀN USER</option>
                                <option value="ADMIN">GÁN QUYỀN ADMIN</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            ) : isSupportView ? (
              <motion.div 
                key="support"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-12 max-w-4xl mx-auto w-full"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <h2 className="text-5xl font-black tracking-tighter text-white uppercase italic">TRUNG TÂM <span className="text-cyan-400">HỖ TRỢ</span></h2>
                  <p className="text-gray-500 text-xs font-bold tracking-[0.2em] uppercase">Chúng tôi luôn sẵn sàng giải đáp mọi thắc mắc của bạn</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* FAQ Section */}
                  <div className="flex flex-col gap-8">
                    <h3 className="text-sm font-black tracking-widest text-white uppercase flex items-center gap-3">
                      <div className="w-1 h-5 bg-cyan-500"></div>
                      CÂU HỎI THƯỜNG GẶP
                    </h3>
                    <div className="flex flex-col gap-4">
                      {faqs.map(faq => (
                        <div key={faq.id} className="bg-white/5 border border-white/5 p-6 rounded-2xl flex flex-col gap-3 group hover:border-cyan-500/30 transition-all">
                          <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-wider">{faq.question}</h4>
                          <p className="text-[11px] text-gray-400 leading-relaxed font-medium uppercase">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact Form Section */}
                  <div className="flex flex-col gap-8">
                    <h3 className="text-sm font-black tracking-widest text-white uppercase flex items-center gap-3">
                      <div className="w-1 h-5 bg-cyan-500"></div>
                      GỬI YÊU CẦU TRỰC TIẾP
                    </h3>
                    <div className="bg-[#16161a] border border-white/5 p-8 rounded-3xl flex flex-col gap-5">
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          type="text" 
                          placeholder="HỌ TÊN" 
                          className="bg-white/5 border border-white/5 rounded-xl p-4 text-[10px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase"
                          value={contactForm.name}
                          onChange={e => setContactForm({...contactForm, name: e.target.value})}
                        />
                        <input 
                          type="email" 
                          placeholder="EMAIL" 
                          className="bg-white/5 border border-white/5 rounded-xl p-4 text-[10px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase"
                          value={contactForm.email}
                          onChange={e => setContactForm({...contactForm, email: e.target.value})}
                        />
                      </div>
                      <input 
                        type="text" 
                        placeholder="CHỦ ĐỀ" 
                        className="bg-white/5 border border-white/5 rounded-xl p-4 text-[10px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase"
                        value={contactForm.subject}
                        onChange={e => setContactForm({...contactForm, subject: e.target.value})}
                      />
                      <textarea 
                        placeholder="NỘI DUNG CHI TIẾT" 
                        rows={5}
                        className="bg-white/5 border border-white/5 rounded-xl p-4 text-[10px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase resize-none"
                        value={contactForm.message}
                        onChange={e => setContactForm({...contactForm, message: e.target.value})}
                      />
                      <button 
                        onClick={handleContactSubmit}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/20 text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 group"
                      >
                        GỬI YÊU CẦU <Send size={14} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key={isWishlistView ? "wishlist" : "home"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-10"
              >
                {!isWishlistView && (
                  <section className="relative h-[400px] md:h-[500px] w-full rounded-[32px] overflow-hidden shadow-2xl shadow-cyan-500/10 border border-white/5 group shrink-0">
                    <img 
                      src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2000" 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent" />
                    </div>
                    <div className="relative h-full flex flex-col justify-end p-8 md:p-16 gap-4 md:gap-6 max-w-3xl">
                      <div className="flex items-center gap-3">
                        <span className="bg-cyan-500 text-black text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider">🔥 HOT RELEASE</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Version 2.4.0 • 12.5GB</span>
                      </div>
                      <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none text-white italic">ETHER REALMS<br/><span className="text-cyan-400">OVERDRIVE</span></h1>
                      <p className="text-gray-400 text-xs md:text-sm font-bold line-clamp-3 leading-relaxed opacity-70 uppercase tracking-wide max-w-xl">
                        Trải nghiệm tựa game hành động thế giới mở đỉnh cao với đồ họa Ray-Tracing thế hệ mới. Khám phá thành phố tương lai đầy rẫy nguy hiểm và cơ hội.
                      </p>
                      <button 
                        onClick={() => games.length > 0 && setSelectedGame(games[0])}
                        className="w-fit bg-white text-black font-black px-10 py-5 rounded-2xl text-[11px] tracking-[0.2em] uppercase hover:bg-cyan-400 transition-all hover:shadow-xl hover:shadow-cyan-500/20 active:scale-95"
                      >
                        KHÁM PHÁ NGAY
                      </button>
                    </div>
                  </section>
                )}

                <section className="flex-1">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-sm font-black tracking-[0.2em] flex items-center gap-3 text-white uppercase">
                      <span className="w-1 h-6 bg-cyan-500"></span>
                      {isWishlistView ? 'DANH SÁCH YÊU THÍCH' : 'MỚI CẬP NHẬT'}
                    </h2>
                    <span className="text-[10px] font-bold text-gray-500">
                      {(isWishlistView ? wishlist : games).length} TRÒ CHƠI
                    </span>
                  </div>
                  
                  {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : (isWishlistView ? wishlist : games).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center bg-[#16161a]/30 rounded-3xl border border-white/5 border-dashed">
                       <Gamepad2 size={48} className="text-gray-700 mb-4" />
                       <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Không có dữ liệu</h3>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                      {(isWishlistView ? wishlist : games).map((game, idx) => (
                        <motion.div
                          key={game.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ y: -8 }}
                          onClick={() => setSelectedGame(game)}
                          className="group cursor-pointer bg-[#0d0d0f] rounded-2xl border border-white/5 overflow-hidden flex flex-col group transition-all hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10"
                        >
                          <div className="aspect-square relative overflow-hidden">
                            <img src={game.thumbnail} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                               <button className="w-full bg-cyan-500 text-black font-black py-3 rounded-xl text-[10px] tracking-widest uppercase transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg shadow-cyan-500/20">
                                 XEM CHI TIẾT
                               </button>
                            </div>
                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-white/10">
                               <span className="text-[11px] font-black text-white italic tracking-tighter">${game.price}</span>
                            </div>
                          </div>
                          <div className="p-5 flex flex-col gap-1">
                             <h3 className="text-[12px] font-black tracking-[0.1em] text-white uppercase line-clamp-1">{game.title}</h3>
                             <div className="flex items-center justify-between">
                               <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{game.category}</span>
                               <div className="flex items-center gap-1">
                                 <Star size={10} className="fill-yellow-500 text-yellow-500" />
                                 <span className="text-[9px] font-black text-gray-400">4.9</span>
                               </div>
                             </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Footer Mini */}
      <footer className="h-16 border-t border-white/5 bg-[#0d0d0f] flex items-center justify-between px-8 text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] shrink-0">
        <div>&copy; 2026 NEXUS GAME PORTAL. HỆ THỐNG PHÂN PHỐI TOÀN CẦU.</div>
        <div className="flex gap-8">
          <span className="hidden sm:inline">Đang trực tuyến: <span className="text-cyan-400 font-black">1.452</span></span>
          <span>Hỗ trợ khách hàng: <span className="text-cyan-400 font-black">24/7</span></span>
        </div>
      </footer>

      {/* Cart Drawer */}
      <AnimatePresence mode="wait">
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0d0d0f] border-l border-white/10 z-[101] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xl font-black tracking-[0.2em] text-white uppercase">SHOPPING CART</h3>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 text-gray-700">
                      <ShoppingBag size={32} />
                    </div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-8">Giỏ hàng của bạn đang trống</p>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="text-[10px] font-black text-cyan-400 hover:text-white transition-colors tracking-widest"
                    >
                      TIẾP TỤC KHÁM PHÁ
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {cart.map((item) => (
                      <div key={item.id} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 group">
                        <div className="w-20 h-24 rounded-lg overflow-hidden shrink-0 border border-white/5">
                          <img src={item.game?.thumbnail} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col justify-between flex-1 py-1">
                          <div>
                            <h4 className="text-[11px] font-black tracking-widest text-white uppercase mb-1">{item.game?.title}</h4>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{item.game?.category}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 bg-black/40 rounded-lg p-1 border border-white/5">
                              <button 
                                onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                className="p-1 hover:text-white text-gray-500 transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-[10px] font-black text-white w-4 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                className="p-1 hover:text-white text-gray-500 transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="p-1.5 text-gray-600 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 border-t border-white/5 bg-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-black text-gray-500 tracking-widest uppercase">Tổng cộng</span>
                    <span className="text-xl font-black text-white">
                      ${cart.reduce((sum, item) => sum + (item.game?.price || 0) * item.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                  <button 
                    disabled={isCheckoutProcessing}
                    onClick={handleCheckout}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest text-[11px] disabled:opacity-50"
                  >
                    {isCheckoutProcessing ? 'PROCESSING...' : 'COMPLETE PURCHASE'}
                  </button>
                  <p className="text-[8px] font-bold text-gray-600 text-center mt-4 uppercase tracking-[0.2em]">Cảm ơn bạn đã tin tưởng Nexus Games</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110]"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-[#0d0d0f] border border-white/10 p-8 md:p-10 rounded-[32px] z-[111] flex flex-col gap-6"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic">
                  {authMode === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}
                </h3>
                <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Truy cập toàn bộ tính năng của Nexus</p>
              </div>

              <div className="flex flex-col gap-4">
                {authMode === 'register' && (
                  <input 
                    type="text" 
                    placeholder="TÊN NGƯỜI DÙNG" 
                    className="bg-white/5 border border-white/5 rounded-xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase"
                    value={authFormData.username}
                    onChange={e => setAuthFormData({...authFormData, username: e.target.value})}
                  />
                )}
                <input 
                  type="email" 
                  placeholder="ĐỊA CHỈ EMAIL" 
                  className="bg-white/5 border border-white/5 rounded-xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase"
                  value={authFormData.email}
                  onChange={e => setAuthFormData({...authFormData, email: e.target.value})}
                />
                <input 
                  type="password" 
                  placeholder="MẬT KHẨU" 
                  className="bg-white/5 border border-white/5 rounded-xl p-4 text-[11px] font-bold tracking-widest text-white outline-none focus:border-cyan-500 transition-all uppercase"
                  value={authFormData.password}
                  onChange={e => setAuthFormData({...authFormData, password: e.target.value})}
                />
              </div>

              <button 
                onClick={authMode === 'login' ? handleLogin : handleRegister}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/20 text-[11px] tracking-widest uppercase"
              >
                {authMode === 'login' ? 'XÁC NHẬN ĐĂNG NHẬP' : 'ĐĂNG KÝ NGAY'}
              </button>

              <div className="text-center">
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-[9px] font-black text-gray-500 hover:text-cyan-400 transition-colors tracking-widest uppercase"
                >
                  {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
