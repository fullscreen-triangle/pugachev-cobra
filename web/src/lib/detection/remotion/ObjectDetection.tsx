import React, { useEffect, useRef, useState } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { ObjectInstance } from '../types';
import { MEEDetectionPipeline } from '../pipeline';
import { parseSelector } from '../selection';

interface ObjectDetectionProps {
  videoSrc: string;
  detectors: string[];
  selector?: string;
  children: (instances: ObjectInstance[]) => React.ReactNode;
}

// Pipeline is module-scoped so it survives re-renders within a single composition run
let _pipeline: MEEDetectionPipeline | null = null;

export const ObjectDetection: React.FC<ObjectDetectionProps> = ({
  videoSrc,
  detectors,
  selector,
  children,
}) => {
  if (typeof window === 'undefined') {
    return <>{children([])}</>;
  }

  return (
    <ObjectDetectionClient
      videoSrc={videoSrc}
      detectors={detectors}
      selector={selector}
    >
      {children}
    </ObjectDetectionClient>
  );
};

const ObjectDetectionClient: React.FC<ObjectDetectionProps> = ({
  videoSrc,
  detectors,
  selector,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [instances, setInstances] = useState<ObjectInstance[]>([]);
  const selectFn = parseSelector(selector ?? 'all');

  useEffect(() => {
    if (!_pipeline) {
      _pipeline = new MEEDetectionPipeline();
      _pipeline.initialize(detectors);
    }
  }, [detectors]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !_pipeline) return;

    let cancelled = false;
    _pipeline.detectFrame(video, frame, fps).then((raw) => {
      if (!cancelled) setInstances(selectFn(raw));
    });

    return () => { cancelled = true; };
  }, [frame, fps, selectFn]);

  return (
    <>
      {/* Hidden video element drives the detector; Remotion's <Video> handles visible playback */}
      <video
        ref={videoRef}
        src={videoSrc}
        style={{ display: 'none' }}
        crossOrigin="anonymous"
      />
      {children(instances)}
    </>
  );
};
