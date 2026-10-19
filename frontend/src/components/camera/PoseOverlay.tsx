import { forwardRef } from "react";

export const PoseOverlay = forwardRef<HTMLCanvasElement>(
  function PoseOverlay(_, ref) {
    return (
      <canvas
        ref={ref}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    );
  },
);
