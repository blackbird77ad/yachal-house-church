import { useCallback, useMemo, useState } from "react";

export const useDraftInteraction = () => {
  const [hasInteracted, setHasInteracted] = useState(false);

  const markInteracted = useCallback(() => {
    setHasInteracted(true);
  }, []);

  const resetDraftInteraction = useCallback(() => {
    setHasInteracted(false);
  }, []);

  const interactionProps = useMemo(
    () => ({
      onChangeCapture: markInteracted,
      onInputCapture: markInteracted,
    }),
    [markInteracted]
  );

  return {
    hasInteracted,
    interactionProps,
    markInteracted,
    resetDraftInteraction,
  };
};

export default useDraftInteraction;
