import { useEffect, useRef } from 'react';
import { Image } from 'react-native';

interface PreloadPost {
  id: string;
  video_url: string;
  thumbnail_url?: string | null;
}

/**
 * Précharge les thumbnails des N prochaines vidéos
 * (les vidéos elles-mêmes sont gérées par react-native-video via shouldPreload prop)
 */
export function useVideoPreloader(
  posts: PreloadPost[],
  currentIndex: number,
  windowSize = 2
) {
  const preloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (currentIndex < 0 || posts.length === 0) return;

    // Précharger thumbnails des N prochaines
    const toPreload = posts.slice(
      Math.max(0, currentIndex + 1),
      Math.min(posts.length, currentIndex + 1 + windowSize)
    ).filter(p => !preloadedRef.current.has(p.id));

    toPreload.forEach(post => {
      preloadedRef.current.add(post.id);
      // Prefetch thumbnail
      if (post.thumbnail_url) {
        Image.prefetch(post.thumbnail_url).catch(() => {});
      }
    });

    // Éviction des très vieilles entrées (économiser mémoire)
    if (currentIndex > 5) {
      const toEvict = posts.slice(0, Math.max(0, currentIndex - 5)).map(p => p.id);
      toEvict.forEach(id => preloadedRef.current.delete(id));
    }
  }, [currentIndex, posts]);
}
