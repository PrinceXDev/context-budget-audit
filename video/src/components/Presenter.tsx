import React, {useEffect, useState} from 'react';
import {
  continueRender,
  delayRender,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {PRESENTER_PHOTO} from '../config';
import {C, F} from '../theme';
import {lineAt} from '../script';

/**
 * The presenter portrait.
 *
 * `pip` is the persistent bottom-right corner presence that runs under the whole
 * video, so the piece reads as one person talking you through their work rather
 * than a faceless product reel. Its ring breathes only while a narration line is
 * actually active, which ties the face to the voice without lip-sync.
 *
 * `hero` is the large end-card portrait.
 *
 * If public/presenter.jpg is missing the component degrades to a monogram - the
 * video still renders, it just loses the face.
 */

const Monogram: React.FC<{size: number}> = ({size}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(150deg, ${C.panelTop}, ${C.panel})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: F.display,
      fontWeight: 600,
      fontSize: size * 0.3,
      letterSpacing: '0.02em',
      color: C.dim,
    }}
  >
    PP
  </div>
);

/**
 * Probes for the portrait once per mount rather than trusting a flag, so the
 * project renders whether or not public/presenter.jpg has been dropped in yet.
 * A missing file degrades to the monogram; it never fails the render.
 */
const usePhoto = (): boolean => {
  const [ok, setOk] = useState(false);
  const [handle] = useState(() => delayRender('probe presenter photo'));

  useEffect(() => {
    let live = true;
    fetch(staticFile(PRESENTER_PHOTO), {method: 'HEAD'})
      .then((r) => {
        if (live) setOk(r.ok);
      })
      .catch(() => {
        if (live) setOk(false);
      })
      .finally(() => continueRender(handle));
    return () => {
      live = false;
    };
  }, [handle]);

  return ok;
};

const Portrait: React.FC<{size: number; offsetY?: number}> = ({size, offsetY = 0}) =>
  usePhoto() ? (
    <Img
      src={staticFile(PRESENTER_PHOTO)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        // The source is a head-and-shoulders portrait, so bias the crop upward
        // to keep the face centred inside a circle rather than the chest.
        objectPosition: `50% ${28 + offsetY}%`,
      }}
    />
  ) : (
    <Monogram size={size} />
  );

/**
 * Rendered at the composition root, never inside a Sequence, so `frame` here is
 * the absolute timeline frame - which is what `lineAt` expects.
 */
export const PresenterPip: React.FC<{
  enterAt?: number;
  /** Frame at which it leaves, for the end card that shows the hero portrait. */
  exitAt?: number;
  size?: number;
}> = ({enterAt = 0, exitAt, size = 132}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const enter = spring({frame: frame - enterAt, fps, config: {damping: 16, mass: 0.6}});
  const leave =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt, exitAt + 20], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
  const s = Math.min(enter, leave);
  if (s <= 0.001) return null;

  const speaking = lineAt(frame) !== null;

  // Breathe only while a line is running. 0.9Hz is slow enough to read as
  // presence rather than as a loading indicator.
  const pulse = speaking ? 0.5 + 0.5 * Math.sin(frame / 5.3) : 0;
  const ring = interpolate(pulse, [0, 1], [0.22, 0.62]);

  return (
    <div
      style={{
        position: 'absolute',
        right: 76,
        bottom: 76,
        opacity: s,
        transform: `translateY(${(1 - s) * 26}px) scale(${0.9 + s * 0.1})`,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          padding: 3,
          background: `conic-gradient(from ${frame * 0.6}deg, ${C.accent}, ${C.ok}, ${C.accent})`,
          opacity: 0.35 + ring * 0.65,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            background: C.bg,
            boxShadow: `0 18px 48px rgba(0,0,0,0.62), 0 0 0 1px ${C.lineStrong}`,
          }}
        >
          <Portrait size={size - 6} />
        </div>
      </div>
    </div>
  );
};

export const PresenterHero: React.FC<{delay?: number; size?: number}> = ({
  delay = 0,
  size = 260,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 18, mass: 0.8}});

  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px) scale(${0.92 + s * 0.08})`,
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -18,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${C.accentGlow} 0%, transparent 68%)`,
          filter: 'blur(26px)',
          opacity: s * 0.9,
        }}
      />
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: `0 0 0 1px ${C.lineStrong}, 0 30px 70px rgba(0,0,0,0.6)`,
        }}
      >
        <Portrait size={size} />
      </div>
    </div>
  );
};
