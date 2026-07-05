import React from 'react';
import { Composition } from 'remotion';
import { LeaveBeforeYouArrive } from '../src/compositions/leave-before-you-arrive/LeaveBeforeYouArrive';
import { BeTheOneWeNeed } from '../src/compositions/be-the-one-we-need/BeTheOneWeNeed';
import { Mbende } from '../src/compositions/mbende/Mbende';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="mbende"
        component={Mbende}
        durationInFrames={4063}
        fps={25}
        width={1920}
        height={1080}
      />
      <Composition
        id="leave-before-you-arrive"
        component={LeaveBeforeYouArrive}
        durationInFrames={1500}
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
