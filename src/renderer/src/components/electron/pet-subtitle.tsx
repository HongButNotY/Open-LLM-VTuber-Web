import { Box, Text } from '@chakra-ui/react';
import { memo, useEffect, useRef, useState } from 'react';
import { useSubtitle } from '@/context/subtitle-context';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';

// How long the subtitle stays after she finishes talking.
const LINGER_MS = 4000;
const GAP_BELOW_PX = 6;
const MAX_WIDTH_PX = 340;
const EDGE_MARGIN_PX = 8;

interface Anchor {
  x: number
  y: number
}

/**
 * Small subtitle that follows the character in pet mode, just below her figure.
 * It ignores the mouse, so clicks pass through to whatever is underneath.
 */
export const PetSubtitle = memo((): JSX.Element | null => {
  const { subtitleText, showPetSubtitle } = useSubtitle();
  const { aiState } = useAiState();

  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);

  // Show while she talks; hide a little after she's done.
  useEffect(() => {
    if (aiState === AiStateEnum.THINKING_SPEAKING) {
      hasSpokenRef.current = true;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setVisible(true);
    } else if (hasSpokenRef.current) {
      hideTimerRef.current = setTimeout(() => setVisible(false), LINGER_MS);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [aiState]);

  // Keep the subtitle under her while she moves or gets dragged.
  useEffect(() => {
    if (!visible || !showPetSubtitle) return undefined;
    let frame = 0;
    let last = 0;
    const update = (time: number) => {
      if (time - last > 100) {
        last = time;
        const bounds = (window as any).getLAppAdapter?.()?.getModelScreenBounds?.();
        if (bounds) {
          const half = Math.min(MAX_WIDTH_PX, window.innerWidth - EDGE_MARGIN_PX * 2) / 2;
          const centerX = (bounds.left + bounds.right) / 2;
          setAnchor({
            x: Math.min(Math.max(centerX, half + EDGE_MARGIN_PX), window.innerWidth - half - EDGE_MARGIN_PX),
            y: Math.min(bounds.bottom + GAP_BELOW_PX, window.innerHeight - 60),
          });
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [visible, showPetSubtitle]);

  if (!showPetSubtitle || !visible || !anchor || !subtitleText) return null;

  return (
    <Box
      position="fixed"
      left={`${anchor.x}px`}
      top={`${anchor.y}px`}
      transform="translateX(-50%)"
      maxW={`${MAX_WIDTH_PX}px`}
      px="10px"
      py="6px"
      bg="rgba(0, 0, 0, 0.6)"
      borderRadius="10px"
      pointerEvents="none"
      zIndex={20}
      transition="opacity 0.3s"
    >
      <Text color="white" fontSize="13px" lineHeight="1.4" textAlign="center" whiteSpace="pre-wrap">
        {subtitleText}
      </Text>
    </Box>
  );
});

PetSubtitle.displayName = 'PetSubtitle';
