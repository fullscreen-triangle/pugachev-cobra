import React from 'react';
import { Composition } from 'remotion';
import { LeaveBeforeYouArrive } from '../src/compositions/leave-before-you-arrive/LeaveBeforeYouArrive';
import { BeTheOneWeNeed } from '../src/compositions/be-the-one-we-need/BeTheOneWeNeed';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="leave-before-you-arrive"
        component={LeaveBeforeYouArrive}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="be-the-one-we-need"
        component={BeTheOneWeNeed}
        durationInFrames={840}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
