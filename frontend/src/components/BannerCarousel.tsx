import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';

import { api } from '@/src/api/client';
import { colors, radii, shadow, spacing } from '@/src/theme';

type Banner = {
  banner_id: string;
  title?: string;
  media_type: 'image' | 'video';
  media_url: string;
  link_url?: string;
  order?: number;
  active?: boolean;
};

const AUTO_SCROLL_MS = 4000;

export function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [width, setWidth] = useState(Dimensions.get('window').width - spacing.lg * 2);
  const [active, setActive] = useState(0);
  const listRef = useRef<FlatList<Banner>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteractingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Banner[]>('/banners');
        if (!cancelled) setBanners(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setBanners([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (banners.length < 2) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (userInteractingRef.current) return;
      setActive((prev) => {
        const next = (prev + 1) % banners.length;
        listRef.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, AUTO_SCROLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length, width]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = width > 0 ? Math.round(x / width) : 0;
      setActive(idx);
      userInteractingRef.current = false;
    },
    [width],
  );

  const onPress = useCallback((b: Banner) => {
    if (!b.link_url) return;
    const url = b.link_url.trim();
    if (!url) return;
    try {
      if (url.startsWith('/')) {
        router.push(url as any);
      } else if (/^[a-z]+:\/\//i.test(url)) {
        // External URL — open via Linking-free route fallback
        router.push(url as any);
      } else {
        // Treat plain string as category filter route
        router.push(`/(tabs)/home?cat=${encodeURIComponent(url)}` as any);
      }
    } catch {
      /* noop */
    }
  }, []);

  if (!banners.length) return null;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(b) => b.banner_id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        decelerationRate="fast"
        onScrollBeginDrag={() => {
          userInteractingRef.current = true;
        }}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <BannerSlide banner={item} width={width} onPress={() => onPress(item)} />
        )}
      />
      {banners.length > 1 ? (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View
              key={b.banner_id}
              style={[styles.dot, i === active && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BannerSlide({
  banner,
  width,
  onPress,
}: {
  banner: Banner;
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.slide, { width }]}>
      {banner.media_type === 'video' ? (
        <VideoSlide url={banner.media_url} />
      ) : (
        <Image
          source={{ uri: banner.media_url }}
          style={styles.media}
          contentFit="contain"
          transition={150}
        />
      )}
    </Pressable>
  );
}

function VideoSlide({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.media}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  slide: {
    aspectRatio: 3 / 2,   // matches banner image (1536×1024)
  },
  media: {
    width: '100%',
    height: '100%',
  },
  dots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF80',
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 16,
  },
});
