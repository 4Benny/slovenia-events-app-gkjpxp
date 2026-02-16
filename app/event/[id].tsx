
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  TextInput,
  Animated as RNAnimated,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/feedback/Toast";
import { useAuth } from "@/contexts/AuthContext";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import * as Brand from "@/constants/Colors";
import { cancelGoingReminders, scheduleGoingReminders } from "@/utils/notifications";
import { extractStoragePath, resolveStorageUrl } from "@/utils/storage";
import { resolveEventCoords } from "@/utils/geo";

interface EventDetail {
  id: string;
  title: string;
  description: string;
  lineup: string | null;
  poster_url: string | null;
  region: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  starts_at: string;
  ends_at: string;
  genre: string;
  age_label: string;
  price_type: string;
  price: number | null;
  ticket_url: string | null;
  status: string;
  organizer_id: string;
}

interface OrganizerProfile {
  username: string;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface EventImage {
  id: string;
  user_id: string;
  image_path?: string | null;
  image_url: string;
  created_at: string;
  profiles: {
    username: string;
  };
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const { user, userRole } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [organizerUsername, setOrganizerUsername] = useState<string>("Organizator");
  const [loading, setLoading] = useState(true);
  const [isGoing, setIsGoing] = useState(false);
  const [goingCount, setGoingCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [images, setImages] = useState<EventImage[]>([]);
  const [newComment, setNewComment] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [userImageCount, setUserImageCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({
    visible: false,
    message: "",
    type: "info",
  });

  // Star animation values
  const [starAnimations] = useState([
    new RNAnimated.Value(1),
    new RNAnimated.Value(1),
    new RNAnimated.Value(1),
    new RNAnimated.Value(1),
    new RNAnimated.Value(1),
  ]);

  useEffect(() => {
    let abortController: AbortController | null = null;

    const fetchEventDetail = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      abortController = new AbortController();

      try {
        setLoading(true);
        console.log("[Event Detail] Fetching event:", id);

        let query = supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();

        query = (query as any).abortSignal(abortController.signal);

        const { data, error: fetchError } = await query;

        if (fetchError) {
          if (fetchError.message?.includes('aborted')) {
            return;
          }
          throw fetchError;
        }

        if (!data) {
          setError({
            title: "Dogodek ni najden",
            message: "Dogodek s tem ID-jem ne obstaja",
          });
          setLoading(false);
          return;
        }

        // Fetch organizer username
        const { data: organizerData, error: organizerError } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.organizer_id)
          .single();

        if (!organizerError && organizerData) {
          setOrganizerUsername(organizerData.username);
        }

        // Check if user is going (only if logged in)
        if (user) {
          const { data: goingData, error: goingError } = await supabase
            .from("event_going")
            .select("id")
            .eq("event_id", id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!goingError && goingData) {
            setIsGoing(true);
          }

          // Check if user has rated
          const { data: ratingData, error: ratingError } = await supabase
            .from("event_ratings")
            .select("rating")
            .eq("event_id", id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!ratingError && ratingData) {
            setUserRating(ratingData.rating);
          }

          // Count user's images for this event
          const { count: imageCount, error: imageCountError } = await supabase
            .from("event_images")
            .select("*", { count: "exact", head: true })
            .eq("event_id", id)
            .eq("user_id", user.id);

          if (!imageCountError) {
            setUserImageCount(imageCount || 0);
          }
        }

        // Get going count
        const { count, error: countError } = await supabase
          .from("event_going")
          .select("*", { count: "exact", head: true })
          .eq("event_id", id);

        if (!countError) {
          setGoingCount(count || 0);
        }

        // Get average rating
        const { data: ratingsData, error: ratingsError } = await supabase
          .from("event_ratings")
          .select("rating")
          .eq("event_id", id);

        if (!ratingsError && ratingsData && ratingsData.length > 0) {
          const sum = ratingsData.reduce((acc, r) => acc + Number(r.rating), 0);
          setAvgRating(sum / ratingsData.length);
        }

        // Fetch comments - FIXED: using 'content' column instead of 'body'
        const { data: commentsData, error: commentsError } = await supabase
          .from("event_comments")
          .select(`
            id,
            user_id,
            content,
            created_at,
            profiles:user_id (
              username,
              avatar_url
            )
          `)
          .eq("event_id", id)
          .order("created_at", { ascending: false });

        if (!commentsError && commentsData) {
          setComments(commentsData as any);
        }

        // Fetch images
        const { data: imagesData, error: imagesError } = await supabase
          .from("event_images")
          .select(`
            id,
            user_id,
            image_url,
            created_at,
            profiles:user_id (
              username
            )
          `)
          .eq("event_id", id)
          .order("created_at", { ascending: false });

        if (!imagesError && imagesData) {
          const resolvedImages = await Promise.all(
            (imagesData as any[]).map(async (img) => ({
              ...img,
              image_path: img.image_url,
              image_url: await resolveStorageUrl({ bucket: "event-images", value: img.image_url }),
            }))
          );
          setImages(resolvedImages as any);
        }

        const resolvedPoster = await resolveStorageUrl({ bucket: "event-posters", value: (data as any)?.poster_url });
        setEvent({ ...(data as any), poster_url: resolvedPoster } as any);
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return;
        }
        console.error("[Event Detail] Error:", err);
        setError({
          title: "Napaka pri nalaganju dogodka",
          message: err.message || "Dogodka ni bilo mogoče naložiti",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetail();

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [id, user]);

  const requestNotificationPermission = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  };

  const showLoginRequiredModal = () => {
    setShowLoginModal(true);
  };

  const handleLoginModalClose = () => {
    setShowLoginModal(false);
  };

  const handleGoToAuth = () => {
    setShowLoginModal(false);
    router.push("/auth" as any);
  };

  const handleGoingToggle = async () => {
    if (!user) {
      console.log("[Event Detail] User not logged in, showing login modal");
      showLoginRequiredModal();
      return;
    }

    if (!event) return;

    const now = new Date();
    const eventStart = new Date(event.starts_at);

    // Check if event has started - user cannot uncheck if event has started
    if (isGoing && now >= eventStart) {
      setToast({
        visible: true,
        message: "Ne morete odstraniti udeležbe, dogodek se je že začel",
        type: "error",
      });
      return;
    }

    try {
      if (isGoing) {
        // User wants to unmark - only allowed before event starts
        const { error: deleteError } = await supabase
          .from("event_going")
          .delete()
          .eq("event_id", id)
          .eq("user_id", user.id);

        if (deleteError) {
          throw deleteError;
        }

        setIsGoing(false);
        setGoingCount(goingCount - 1);

        await cancelGoingReminders(id as string);

        setToast({
          visible: true,
          message: "Odstranjeno iz vaših dogodkov",
          type: "success",
        });
      } else {
        // User wants to mark as going
        // Request notification permission
        const hasPermission = await requestNotificationPermission();
        
        if (!hasPermission) {
          setToast({
            visible: true,
            message: "Dovoljenje za obvestila je zavrnjeno. Omogočite ga v nastavitvah za prejemanje opomnikov.",
            type: "info",
          });
        }

        const { error: insertError } = await supabase
          .from("event_going")
          .insert({
            event_id: id as string,
            user_id: user.id,
          });

        if (insertError) {
          throw insertError;
        }

        setIsGoing(true);
        setGoingCount(goingCount + 1);

        if (hasPermission) {
          await scheduleGoingReminders({
            eventId: id as string,
            eventTitle: event.title,
            startsAtISO: event.starts_at,
          });
        }

        setToast({
          visible: true,
          message: hasPermission 
            ? "Dodano v vaše dogodke. Prejeli boste opomnik 1 dan in 3 ure pred dogodkom." 
            : "Dodano v vaše dogodke.",
          type: "success",
        });
      }
    } catch (err: any) {
      console.error("[Event Detail] Going toggle error:", err);
      setToast({
        visible: true,
        message: err.message || "Posodobitev udeležbe ni uspela",
        type: "error",
      });
    }
  };

  const animateStars = (rating: number) => {
    // Reset all animations
    starAnimations.forEach((anim) => anim.setValue(1));

    // Animate stars from 1 to selected rating
    const animations = [];
    for (let i = 0; i < rating; i++) {
      animations.push(
        RNAnimated.sequence([
          RNAnimated.timing(starAnimations[i], {
            toValue: 1.3,
            duration: 150,
            useNativeDriver: true,
          }),
          RNAnimated.timing(starAnimations[i], {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ])
      );
    }

    RNAnimated.stagger(100, animations).start();
  };

  const handleRating = async (rating: number) => {
    console.log("[Event Detail] Rating attempt:", rating, "User:", user ? "logged in" : "not logged in");
    
    if (!user) {
      console.log("[Event Detail] User not logged in, showing login modal");
      showLoginRequiredModal();
      return;
    }

    if (!event) return;

    // Check if user has already rated
    if (userRating !== null) {
      setToast({
        visible: true,
        message: "Dogodek ste že ocenili",
        type: "error",
      });
      return;
    }

    // Check if event has ended and within 7 days
    const now = new Date();
    const eventEnd = new Date(event.ends_at);
    const sevenDaysAfter = new Date(eventEnd);
    sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);

    if (now < eventEnd) {
      setToast({
        visible: true,
        message: "Dogodek lahko ocenite šele po koncu",
        type: "error",
      });
      return;
    }

    if (now > sevenDaysAfter) {
      setToast({
        visible: true,
        message: "Ocenjevanje je možno samo 7 dni po dogodku",
        type: "error",
      });
      return;
    }

    // Check if user was going to the event
    const { data: goingData, error: goingError } = await supabase
      .from("event_going")
      .select("id")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (goingError || !goingData) {
      setToast({
        visible: true,
        message: "Ocenite lahko samo dogodke, na katerih ste bili",
        type: "error",
      });
      return;
    }

    // Animate stars
    animateStars(rating);

    try {
      console.log("[Event Detail] Submitting rating:", rating);
      const { error: insertError } = await supabase
        .from("event_ratings")
        .insert({
          event_id: id as string,
          user_id: user.id,
          rating: rating,
        });

      if (insertError) {
        throw insertError;
      }

      setUserRating(rating);
      
      // Recalculate average rating
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("event_ratings")
        .select("rating")
        .eq("event_id", id);

      if (!ratingsError && ratingsData && ratingsData.length > 0) {
        const sum = ratingsData.reduce((acc, r) => acc + Number(r.rating), 0);
        setAvgRating(sum / ratingsData.length);
      }

      setToast({
        visible: true,
        message: "Hvala za vašo oceno!",
        type: "success",
      });
    } catch (err: any) {
      console.error("[Event Detail] Rating error:", err);
      setToast({
        visible: true,
        message: err.message || "Ocenjevanje ni uspelo",
        type: "error",
      });
    }
  };

  const handleAddComment = async () => {
    if (!user) {
      showLoginRequiredModal();
      return;
    }

    if (!event) return;

    if (!newComment.trim()) {
      setToast({
        visible: true,
        message: "Komentar ne more biti prazen",
        type: "error",
      });
      return;
    }

    // Check if user was going to the event
    const { data: goingData, error: goingError } = await supabase
      .from("event_going")
      .select("id")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (goingError || !goingData) {
      setToast({
        visible: true,
        message: "Komentirati lahko samo dogodke, na katerih ste bili",
        type: "error",
      });
      return;
    }

    // Check if event has ended and within 7 days
    const now = new Date();
    const eventEnd = new Date(event.ends_at);
    const sevenDaysAfter = new Date(eventEnd);
    sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);

    if (now < eventEnd) {
      setToast({
        visible: true,
        message: "Komentirati lahko šele po koncu dogodka",
        type: "error",
      });
      return;
    }

    if (now > sevenDaysAfter) {
      setToast({
        visible: true,
        message: "Komentiranje je možno samo 7 dni po dogodku",
        type: "error",
      });
      return;
    }

    try {
      // FIXED: using 'content' column instead of 'body'
      const { data, error: insertError } = await supabase
        .from("event_comments")
        .insert({
          event_id: id as string,
          user_id: user.id,
          content: newComment.trim(),
        })
        .select(`
          id,
          user_id,
          content,
          created_at,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      setComments([data as any, ...comments]);
      setNewComment("");
      setToast({
        visible: true,
        message: "Komentar dodan",
        type: "success",
      });
    } catch (err: any) {
      console.error("[Event Detail] Comment error:", err);
      setToast({
        visible: true,
        message: err.message || "Dodajanje komentarja ni uspelo",
        type: "error",
      });
    }
  };

  const handleDeleteComment = async (commentId: string, commentUserId: string) => {
    if (!user) {
      showLoginRequiredModal();
      return;
    }

    // Only admin or comment owner can delete
    if (userRole !== "admin" && user.id !== commentUserId) {
      setToast({
        visible: true,
        message: "Nimate dovoljenja za brisanje tega komentarja",
        type: "error",
      });
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("event_comments")
        .delete()
        .eq("id", commentId);

      if (deleteError) {
        throw deleteError;
      }

      setComments(comments.filter((c) => c.id !== commentId));
      setToast({
        visible: true,
        message: "Komentar izbrisan",
        type: "success",
      });
    } catch (err: any) {
      console.error("[Event Detail] Delete comment error:", err);
      setToast({
        visible: true,
        message: err.message || "Brisanje komentarja ni uspelo",
        type: "error",
      });
    }
  };

  const handleUploadImage = async () => {
    if (!user) {
      showLoginRequiredModal();
      return;
    }

    if (!event) return;

    if (userImageCount >= 5) {
      setToast({
        visible: true,
        message: "Lahko naložite največ 5 slik na dogodek",
        type: "error",
      });
      return;
    }

    // Check if user was going to the event
    const { data: goingData, error: goingError } = await supabase
      .from("event_going")
      .select("id")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (goingError || !goingData) {
      setToast({
        visible: true,
        message: "Naložiti lahko slike samo za dogodke, na katerih ste bili",
        type: "error",
      });
      return;
    }

    // Check if event has ended and within 7 days
    const now = new Date();
    const eventEnd = new Date(event.ends_at);
    const sevenDaysAfter = new Date(eventEnd);
    sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);

    if (now < eventEnd) {
      setToast({
        visible: true,
        message: "Slike lahko naložite šele po koncu dogodka",
        type: "error",
      });
      return;
    }

    if (now > sevenDaysAfter) {
      setToast({
        visible: true,
        message: "Nalaganje slik je možno samo 7 dni po dogodku",
        type: "error",
      });
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        setToast({
          visible: true,
          message: "Dovoljenje za dostop do fotografij je potrebno",
          type: "error",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      setUploadingImage(true);

      const image = result.assets[0];
      const filePath = `${id}/${user.id}/${Date.now()}.jpg`;

      const mime = image.mimeType || "image/jpeg";
      const sourceUri = image.base64
        ? `data:${mime};base64,${image.base64}`
        : image.uri;
      const arrayBuffer = await (await fetch(sourceUri)).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("event-images")
        .upload(filePath, arrayBuffer, {
          contentType: mime,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const publicUrl = supabase.storage.from("event-images").getPublicUrl(filePath).data.publicUrl;

      const { data, error: insertError } = await supabase
        .from("event_images")
        .insert({
          event_id: id as string,
          user_id: user.id,
          // Store public URL for consistency with older rows.
          image_url: publicUrl,
        })
        .select(`
          id,
          user_id,
          image_url,
          created_at,
          profiles:user_id (
            username
          )
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      const resolvedUrl = await resolveStorageUrl({ bucket: "event-images", value: (data as any)?.image_url });
      setImages((prev) => [{ ...(data as any), image_path: filePath, image_url: resolvedUrl } as any, ...prev]);
      setUserImageCount((prev) => prev + 1);
      setToast({
        visible: true,
        message: "Slika naložena",
        type: "success",
      });
    } catch (err: any) {
      console.error("[Event Detail] Upload image error:", err);
      setToast({
        visible: true,
        message: err.message || "Nalaganje slike ni uspelo",
        type: "error",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (imageId: string, imageUserId: string, imagePathOrUrl?: string | null) => {
    if (!user) {
      showLoginRequiredModal();
      return;
    }

    // Only admin or image owner can delete
    if (userRole !== "admin" && user.id !== imageUserId) {
      setToast({
        visible: true,
        message: "Nimate dovoljenja za brisanje te slike",
        type: "error",
      });
      return;
    }

    try {
      const storagePath = extractStoragePath({ bucket: "event-images", value: imagePathOrUrl ?? undefined });
      if (storagePath) {
        const { error: removeError } = await supabase.storage.from("event-images").remove([storagePath]);
        if (removeError) {
          console.warn("[Event Detail] Failed to remove image from storage:", removeError);
        }
      }

      const { error: deleteError } = await supabase
        .from("event_images")
        .delete()
        .eq("id", imageId);

      if (deleteError) {
        throw deleteError;
      }

      setImages((prev) => prev.filter((img) => img.id !== imageId));
      if (user.id === imageUserId) {
        setUserImageCount((prev) => Math.max(0, prev - 1));
      }
      setToast({
        visible: true,
        message: "Slika izbrisana",
        type: "success",
      });
    } catch (err: any) {
      console.error("[Event Detail] Delete image error:", err);
      setToast({
        visible: true,
        message: err.message || "Brisanje slike ni uspelo",
        type: "error",
      });
    }
  };

  const openMaps = () => {
    if (!event) return;
    const coords = resolveEventCoords(event);
    const lat = coords?.lat ?? event.lat;
    const lng = coords?.lng ?? event.lng;
    const url = `https://maps.apple.com/?q=${encodeURIComponent(event.address)}&ll=${lat},${lng}`;
    Linking.openURL(url);
  };

  const handleViewAttendees = () => {
    if (!user) {
      console.log("[Event Detail] User not logged in, showing login modal");
      showLoginRequiredModal();
      return;
    }
    router.push(`/event/attendees/${id}` as any);
  };

  const handleViewOrganizer = () => {
    if (!user) {
      console.log("[Event Detail] User not logged in, showing login modal");
      showLoginRequiredModal();
      return;
    }
    if (!event) return;
    console.log("[Event Detail] Navigating to organizer profile:", event.organizer_id);
    router.push(`/organizer/profile/${event.organizer_id}` as any);
  };

  if (loading) {
    return (
      <Animated.View 
        entering={FadeIn.duration(300)}
        style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Nalaganje...</Text>
      </Animated.View>
    );
  }

  if (!event) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Dogodek",
            headerShown: true,
            headerBackTitleVisible: false,
            headerBackTitle: "",
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => {
                  try {
                    router.back();
                  } catch {
                    router.replace("/(tabs)/(home)/" as any);
                  }
                }}
                style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                activeOpacity={0.8}
              >
                <IconSymbol
                  ios_icon_name="arrow.left"
                  android_material_icon_name="arrow-back"
                  size={22}
                  color={Brand.accentOrange}
                />
              </TouchableOpacity>
            ),
          } as any}
        />
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="error"
            size={64}
            color={Brand.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>Dogodek ni najden</Text>
        </View>
      </>
    );
  }

  const startsAtDate = event.starts_at ? new Date(event.starts_at) : new Date();
  const endsAtDate = event.ends_at ? new Date(event.ends_at) : new Date();
  const now = new Date();
  const dateDisplay = startsAtDate.toLocaleDateString("sl-SI", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeDisplay = startsAtDate.toLocaleTimeString("sl-SI", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const priceText = event.price_type === "free" ? "Brezplačno" : `€${event.price || 0}`;
  const isCancelled = event.status === "cancelled";
  const hasEnded = now > endsAtDate;
  const isOngoing = now >= startsAtDate && now <= endsAtDate;
  const sevenDaysAfterEnd = new Date(endsAtDate);
  sevenDaysAfterEnd.setDate(sevenDaysAfterEnd.getDate() + 7);
  const canInteract = hasEnded && now <= sevenDaysAfterEnd;

  const goingButtonText = isGoing ? "Ne Grem" : "Grem";
  const goingButtonDisabled = isGoing && now >= startsAtDate;

  return (
    <>
      <Stack.Screen
        options={{
          title: event.title,
          headerShown: true,
          headerBackTitle: "",
          headerBackTitleVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                try {
                  router.back();
                } catch {
                  router.replace("/(tabs)/(home)/" as any);
                }
              }}
              style={{ paddingHorizontal: 8, paddingVertical: 6 }}
              activeOpacity={0.8}
            >
              <IconSymbol
                ios_icon_name="arrow.left"
                android_material_icon_name="arrow-back"
                size={22}
                color={Brand.accentOrange}
              />
            </TouchableOpacity>
          ),
          animation: "slide_from_right",
        } as any}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {event.poster_url && (
            <Image source={{ uri: event.poster_url }} style={styles.poster} />
          )}

          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.colors.text }]}>{event.title}</Text>
                <TouchableOpacity 
                  style={styles.goingBadge}
                  onPress={handleViewAttendees}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    ios_icon_name="person.2.fill"
                    android_material_icon_name="people"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.goingBadgeText, { color: theme.colors.primary }]}>
                    {goingCount}
                  </Text>
                </TouchableOpacity>
              </View>
              {isCancelled && (
                <View style={[styles.badge, styles.cancelledBadge]}>
                  <Text style={styles.badgeText}>PREKLICANO</Text>
                </View>
              )}
            </View>

            {avgRating !== null && (
              <View style={styles.ratingDisplay}>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isLit = star <= Math.round(avgRating);
                    return (
                      <Text key={star} style={styles.star}>
                        {isLit ? "⭐" : "☆"}
                      </Text>
                    );
                  })}
                </View>
                <Text style={[styles.ratingText, { color: Brand.textSecondary }]}>
                  {avgRating.toFixed(1)}
                </Text>
                <Text style={[styles.ratingText, { color: Brand.textSecondary }]}>
                  /
                </Text>
                <Text style={[styles.ratingText, { color: Brand.textSecondary }]}>
                  5.0
                </Text>
              </View>
            )}

            <View style={styles.metaSection}>
              <View style={styles.metaRow}>
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="event"
                  size={20}
                  color={Brand.secondaryGradientEnd}
                />
                <Text style={[styles.metaText, { color: theme.colors.text }]}>
                  {dateDisplay}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <IconSymbol
                  ios_icon_name="clock"
                  android_material_icon_name="access-time"
                  size={20}
                  color={Brand.secondaryGradientEnd}
                />
                <Text style={[styles.metaText, { color: theme.colors.text }]}>
                  {timeDisplay}
                </Text>
              </View>

              <TouchableOpacity style={styles.metaRow} onPress={openMaps}>
                <IconSymbol
                  ios_icon_name="location.fill"
                  android_material_icon_name="location-on"
                  size={20}
                  color={Brand.highlightYellow}
                />
                <Text style={[styles.metaText, { color: theme.colors.primary }]}>
                  {event.address}
                </Text>
              </TouchableOpacity>

              <View style={styles.metaRow}>
                <IconSymbol
                  ios_icon_name="music.note"
                  android_material_icon_name="music-note"
                  size={20}
                  color={Brand.secondaryGradientEnd}
                />
                <Text style={[styles.metaText, { color: theme.colors.text }]}>
                  {event.genre}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <IconSymbol
                  ios_icon_name="ticket"
                  android_material_icon_name="confirmation-number"
                  size={20}
                  color={Brand.secondaryGradientEnd}
                />
                <Text style={[styles.metaText, { color: theme.colors.text }]}>
                  {priceText}
                </Text>
              </View>

              {event.ticket_url && (
                null
              )}

              <TouchableOpacity style={styles.metaRow} onPress={handleViewOrganizer}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={20}
                  color={Brand.secondaryGradientEnd}
                />
                <Text style={[styles.metaText, { color: theme.colors.primary }]}>
                  {organizerUsername}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { backgroundColor: theme.colors.card }]}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>O dogodku</Text>
              <Text style={[styles.description, { color: theme.colors.text }]}
              >
                {event.description || "Ni opisa"}
              </Text>
              {event.lineup ? (
                <>
                  <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Lineup</Text>
                  <Text style={[styles.description, { color: theme.colors.text }]}
                  >
                    {event.lineup}
                  </Text>
                </>
              ) : null}
            </View>

            {!hasEnded && !isCancelled && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    isGoing && { backgroundColor: Brand.accentOrange },
                    goingButtonDisabled && { opacity: 0.5 },
                  ]}
                  onPress={handleGoingToggle}
                  disabled={goingButtonDisabled}
                >
                  <IconSymbol
                    ios_icon_name={isGoing ? "checkmark.circle.fill" : "plus.circle"}
                    android_material_icon_name={isGoing ? "check-circle" : "add-circle"}
                    size={24}
                    color={isGoing ? Brand.primaryGradientStart : Brand.accentOrange}
                  />
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: isGoing ? Brand.primaryGradientStart : Brand.accentOrange },
                    ]}
                  >
                    {goingButtonText}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {canInteract && userRating === null && (
              <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ocenite dogodek</Text>
                <View style={styles.ratingSection}>
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const isLit = hoveredRating !== null ? rating <= hoveredRating : false;
                    return (
                      <TouchableOpacity
                        key={rating}
                        onPress={() => handleRating(rating)}
                        onPressIn={() => setHoveredRating(rating)}
                        onPressOut={() => setHoveredRating(null)}
                        style={styles.ratingButton}
                      >
                        <RNAnimated.Text 
                          style={[
                            styles.starLarge,
                            {
                              transform: [{ scale: starAnimations[rating - 1] }],
                              color: isLit ? Brand.starActive : Brand.starInactive,
                            },
                          ]}
                        >
                          {isLit ? "⭐" : "☆"}
                        </RNAnimated.Text>
                        <Text style={[styles.ratingLabel, { color: theme.colors.text }]}>{rating}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {userRating !== null && (
              <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Vaša ocena</Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isLit = star <= userRating;
                    return (
                      <Text key={star} style={[styles.star, { color: isLit ? Brand.starActive : Brand.starInactive }]}>
                        {isLit ? "⭐" : "☆"}
                      </Text>
                    );
                  })}
                </View>
              </View>
            )}



            {canInteract && (
              <>
                <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                      Slike
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: Brand.textSecondary }]}>
                      {userImageCount}
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: Brand.textSecondary }]}>
                      /
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: Brand.textSecondary }]}>
                      5
                    </Text>
                  </View>
                  {images.length > 0 && (
                    <View style={styles.imagesGrid}>
                      {images.map((img) => (
                        <View key={img.id} style={styles.imageContainer}>
                          <Image source={{ uri: img.image_url }} style={styles.eventImageThumb} />
                          {(userRole === "admin" || user?.id === img.user_id) && (
                            <TouchableOpacity
                              style={styles.deleteImageButton}
                              onPress={() => handleDeleteImage(img.id, img.user_id, img.image_path ?? img.image_url)}
                            >
                              <IconSymbol
                                ios_icon_name="trash"
                                android_material_icon_name="delete"
                                size={16}
                                color={Brand.textPrimary}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  {userImageCount < 5 && (
                    <TouchableOpacity
                      style={[styles.uploadButton, { borderColor: theme.colors.primary }]}
                      onPress={handleUploadImage}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <ActivityIndicator color={theme.colors.primary} />
                      ) : (
                        <>
                          <IconSymbol
                            ios_icon_name="photo"
                            android_material_icon_name="add-photo-alternate"
                            size={24}
                            color={theme.colors.primary}
                          />
                          <Text style={[styles.uploadButtonText, { color: theme.colors.primary }]}>
                            Naloži sliko
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Komentarji</Text>
                  </View>
                  <View style={styles.commentInputContainer}>
                    <TextInput
                      style={[styles.commentInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                      placeholder="Dodaj komentar..."
                      placeholderTextColor={Brand.textSecondary}
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                      maxLength={300}
                    />
                    <TouchableOpacity
                      style={[styles.commentButton, { backgroundColor: theme.colors.primary }]}
                      onPress={handleAddComment}
                    >
                      <IconSymbol
                        ios_icon_name="paperplane.fill"
                        android_material_icon_name="send"
                        size={20}
                        color={Brand.primaryGradientStart}
                      />
                    </TouchableOpacity>
                  </View>
                  {comments.length > 0 && (
                    <View style={styles.commentsList}>
                      {comments.map((comment) => (
                        <View key={comment.id} style={[styles.commentCard, { backgroundColor: theme.colors.card }]}>
                          <View style={styles.commentHeader}>
                            <View style={styles.commentUserInfo}>
                              {comment.profiles.avatar_url ? (
                                <Image source={{ uri: comment.profiles.avatar_url }} style={styles.commentAvatar} />
                              ) : (
                                <View style={[styles.commentAvatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                                  <IconSymbol
                                    ios_icon_name="person.fill"
                                    android_material_icon_name="person"
                                    size={16}
                                    color={Brand.primaryGradientStart}
                                  />
                                </View>
                              )}
                              <Text style={[styles.commentUsername, { color: theme.colors.text }]}>
                                {comment.profiles.username}
                              </Text>
                            </View>
                            {(userRole === "admin" || user?.id === comment.user_id) && (
                              <TouchableOpacity onPress={() => handleDeleteComment(comment.id, comment.user_id)}>
                                <IconSymbol
                                  ios_icon_name="trash"
                                  android_material_icon_name="delete"
                                  size={18}
                                  color={theme.colors.notification}
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={[styles.commentBody, { color: theme.colors.text }]}>
                            {comment.content}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            {event.ticket_url && (
              <TouchableOpacity
                style={[styles.ticketButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => Linking.openURL(event.ticket_url!)}
              >
                <Text style={styles.ticketButtonText}>Kupi vstopnice</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {error && (
          <Modal
            visible={!!error}
            title={error.title}
            message={error.message}
            onClose={() => setError(null)}
          />
        )}

        {showLoginModal && (
          <Modal
            visible={showLoginModal}
            title="Prijava potrebna"
            message="Najprej se morate prijaviti!"
            onClose={handleLoginModalClose}
            type="confirm"
            confirmText="Prijava"
            cancelText="Prekliči"
            onConfirm={handleGoToAuth}
          />
        )}

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 8,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  poster: {
    width: "100%",
    height: 300,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    flex: 1,
    marginRight: 12,
  },
  goingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
  },
  goingBadgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: Brand.secondaryGradientEnd,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  cancelledBadge: {
    backgroundColor: Brand.dangerRed,
  },
  badgeText: {
    color: Brand.textPrimary,
    fontSize: 12,
    fontWeight: "bold",
  },
  ratingDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  stars: {
    flexDirection: "row",
    gap: 4,
  },
  star: {
    fontSize: 20,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  metaSection: {
    gap: 12,
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18, // Pill shape (16-20px)
    borderWidth: 2,
    borderColor: Brand.accentOrange,
    shadowColor: Brand.glowOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  sectionSubtitle: {
    fontSize: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  subSectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "700",
  },
  ratingSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  ratingButton: {
    alignItems: "center",
    gap: 4,
  },
  starLarge: {
    fontSize: 32,
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  imageContainer: {
    position: "relative",
    width: "31%",
    aspectRatio: 1,
  },
  eventImageThumb: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  deleteImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: Brand.dangerRed,
    opacity: 0.9,
    borderRadius: 12,
    padding: 4,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  commentInputContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    minHeight: 44,
    maxHeight: 100,
    textAlignVertical: "top",
  },
  commentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  commentsList: {
    gap: 12,
  },
  commentCard: {
    padding: 12,
    borderRadius: 8,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  commentUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: "600",
  },
  commentBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  ticketButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  ticketButtonText: {
    color: Brand.primaryGradientStart,
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
  },
});
