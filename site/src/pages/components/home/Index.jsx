import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { DESK_TEXT } from '@src/lib';
import SignalField from '@src/components/artwork/SignalField';
import InfiniteText from '@src/components/animationComponents/infiniteText/Index';
import clsx from 'clsx';
import { gsap } from 'gsap';
import styles from '@src/pages/components/home/styles/home.module.scss';
import useInView from '@src/hooks/useInView';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import useStill from '@src/hooks/useStill';

const moveRect = (rect, direction, gridWidth, gridHeight) => {
  const moveMap = {
    left: () => {
      rect.x = `${(parseFloat(rect.x) - gridWidth).toFixed(2)}%`;
    },
    right: () => {
      rect.x = `${(parseFloat(rect.x) + gridWidth).toFixed(2)}%`;
    },
    up: () => {
      rect.y = `${(parseFloat(rect.y) - gridHeight).toFixed(2)}%`;
    },
    down: () => {
      rect.y = `${(parseFloat(rect.y) + gridHeight).toFixed(2)}%`;
    },
  };
  moveMap[direction]?.();
};

const arePositionsEqual = (pos1, pos2) => pos1.x === pos2.x && pos1.y === pos2.y;

const isPositionOccupied = (rects, pos) => rects.some((rect) => arePositionsEqual(rect, pos));

const performMoves = (rectangles, gridWidth, gridHeight) => {
  const totalGroups = Math.floor(Math.random() * 8) + 1;
  const allMovements = [];

  for (let i = 0; i < totalGroups; i += 1) {
    const validMoves = [];
    const togetherMoves = Math.floor(Math.random() * 3) + 1;

    for (let k = 0; k < togetherMoves; k += 1) {
      const randomRectIndex = k === 0 || validMoves.length === 0 ? Math.floor(Math.random() * rectangles.length) : rectangles.findIndex((_, idx) => !validMoves.some((move) => move.index === idx));

      if (randomRectIndex === -1) break;

      const rect = { ...rectangles[randomRectIndex] };
      const originalPosition = { ...rectangles[randomRectIndex] };
      let validMove = false;

      ['left', 'right', 'up', 'down'].forEach((direction) => {
        if (validMove) return;

        moveRect(rect, direction, gridWidth, gridHeight);
        const newPosition = { ...rect };

        const { x, y } = { x: parseFloat(newPosition.x), y: parseFloat(newPosition.y) };
        if (x > -0.5 && x < 90 && y > -0.5 && y < 90 && !isPositionOccupied(rectangles, newPosition)) {
          validMove = true;
          validMoves.push({ index: newPosition.index, x: newPosition.x, y: newPosition.y });
          Object.assign(rectangles[newPosition.index], newPosition);
        } else {
          Object.assign(rect, originalPosition);
        }
      });
    }

    if (validMoves.length > 0) {
      allMovements.push(validMoves);
    }
  }

  return allMovements;
};

// The Desk masthead: the original hero (headline, lede, the masked hole grid over
// the continuous signal field, the "Scroll Down" marquee) carrying the old Desk's
// h1 and lede. The holes shuffle only while the hero is on screen and motion
// is on. Kairo's artwork sits beneath the unchanged moving window mask.
function Home() {
  const isMobile = useIsMobile();
  const still = useStill();
  const timelineRef = useRef(null);
  const rootRef = useRef();
  const rectRefs = useRef([]);
  const svgRef = useRef();
  const divWrapper = useRef();
  const infiniteTextRef = useRef();
  const visible = useInView(rootRef);
  const active = visible && !still;

  const initialPositions = useMemo(
    () =>
      !isMobile
        ? [
            { index: 0, x: '0.00%', y: '50.00%' },
            { index: 1, x: '16.67%', y: '0.00%' },
            { index: 2, x: '33.34%', y: '0.00%' },
            { index: 3, x: '50.01%', y: '0.00%' },
            { index: 4, x: '66.68%', y: '50.00%' },
            { index: 5, x: '83.35%', y: '50.00%' },
            { index: 6, x: '33.34%', y: '50.00%' },
          ]
        : [
            { index: 0, x: '0.00%', y: '0.00%' },
            { index: 1, x: '20.00%', y: '0.00%' },
            { index: 2, x: '60.00%', y: '0.00%' },
            { index: 3, x: '20.00%', y: '20.00%' },
            { index: 4, x: '80.00%', y: '20.00%' },
            { index: 5, x: '20.00%', y: '40.00%' },
            { index: 6, x: '60.00%', y: '40.00%' },
            { index: 7, x: '40.00%', y: '60.00%' },
            { index: 8, x: '80.00%', y: '60.00%' },
            { index: 9, x: '20.00%', y: '80.00%' },
            { index: 10, x: '60.00%', y: '80.00%' },
          ],
    [isMobile],
  );

  const gridWidth = useMemo(() => (!isMobile ? 16.67 : 20.0), [isMobile]);
  const gridHeight = useMemo(() => (!isMobile ? 50.0 : 20.0), [isMobile]);

  const animateRectangles = useCallback(
    (movements) => {
      const tl = gsap.timeline({
        onComplete: () => {
          const newMovements = performMoves(initialPositions, gridWidth, gridHeight);
          timelineRef.current = animateRectangles(newMovements);
        },
      });

      movements.forEach((movementGroup, groupIndex) => {
        movementGroup.forEach(({ index, x, y }, rectIndex) => {
          if (groupIndex === 0 && rectIndex === 0) {
            tl.to(
              rectRefs.current[index],
              {
                ease: 'power2.inOut',
                duration: 1,
                attr: { x, y },
                delay: 2,
              },
              0,
            );
          } else if (rectIndex === 0) {
            tl.to(
              rectRefs.current[index],
              {
                ease: 'power2.inOut',
                duration: 1,
                attr: { x, y },
                delay: 0,
              },
              '>',
            );
          } else {
            tl.to(
              rectRefs.current[index],
              {
                ease: 'power2.inOut',
                duration: 1,
                attr: { x, y },
                delay: 0,
              },
              '<',
            );
          }
        });
      });

      return tl;
    },
    [gridWidth, gridHeight, initialPositions],
  );

  // Hole shuffle: started once per layout, paused off screen and with motion off.
  useIsomorphicLayoutEffect(() => {
    timelineRef.current = animateRectangles(performMoves(initialPositions, gridWidth, gridHeight));
    timelineRef.current.pause();

    return () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
    };
  }, [animateRectangles]);

  useEffect(() => {
    const tl = timelineRef.current;
    if (!tl) return;
    if (active) tl.play();
    else tl.pause();
  }, [active, animateRectangles]);

  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top+=3%',
            end: 'top+=5%',
            toggleActions: 'play none reverse none',
            scroller: document.querySelector('main'),
            invalidateOnRefresh: true,
          },
        })
        .to(infiniteTextRef.current, {
          opacity: 0,
          duration: 0.6,
        });
    });

    return () => ctx.kill();
  }, []);

  // Desktop hover reveals the whole window (a tap on a phone does not).
  const onPointerEnter = (event) => {
    if (event.pointerType === 'touch') return;
    gsap.to(svgRef.current, { autoAlpha: 0 });
    gsap.to(divWrapper.current, { autoAlpha: 0 });
  };

  const onPointerLeave = (event) => {
    if (event.pointerType === 'touch') return;
    gsap.to(svgRef.current, { autoAlpha: 1 });
    gsap.to(divWrapper.current, { autoAlpha: 1 });
  };

  const renderRects = useMemo(
    // eslint-disable-next-line no-return-assign
    () => initialPositions.map(({ index, x, y }) => <rect key={index} ref={(ref) => (rectRefs.current[index] = ref)} x={x} y={y} width={`${gridWidth}%`} height={`${gridHeight}%`} />),
    [initialPositions, gridWidth, gridHeight],
  );

  return (
    <section ref={rootRef} className={clsx(styles.root)}>
      <div className={clsx(styles.topContainer, 'layout-grid-inner')}>
        <h1 className={styles.leftContainer}>
          <span className="h2">{DESK_TEXT.heading}</span>
          <span className={clsx('h2', 'bold')}>{DESK_TEXT.headingTerm}</span>
        </h1>
        <p className={clsx('h6', styles.rightContainer)}>{DESK_TEXT.lede}</p>
      </div>

      <div className={styles.bottomContainer} aria-hidden="true">
        <SignalField />
        <div onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} className={styles.svgWrapper}>
          <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="0" y="0" className={styles.mask2} width="100%" height="100.3%" />
            <mask id="mask" x="0" y="0">
              <rect className={styles.mask1} x="0" y="0" width="100%" height="100.3%" />
              {renderRects}
            </mask>
          </svg>
          <div ref={divWrapper} />
        </div>
      </div>
      <div className={styles.rightContainerMobile}>
        <p className="h6">{DESK_TEXT.lede}</p>
      </div>

      <div ref={infiniteTextRef} className={styles.infiniteContainer} aria-hidden="true">
        <InfiniteText text="Scroll Down" length={5} />
      </div>
    </section>
  );
}

export default memo(Home);
