import React from 'react';
import { useSpring, config, animated } from 'react-spring';
import styled from 'styled-components';

import { Translation, TroubleshootingTips, WebusbButton } from '@suite-components';
import { isLinux } from '@suite-utils/env';

import {
    TROUBLESHOOTING_TIP_BRIDGE,
    TROUBLESHOOTING_TIP_CABLE,
    TROUBLESHOOTING_TIP_USB,
    TROUBLESHOOTING_TIP_DIFFERENT_COMPUTER,
    TROUBLESHOOTING_TIP_UDEV,
} from '@suite-components/TroubleshootingTips/tips';

const Wrapper = styled(animated.div)`
    display: flex;
`;

interface Props {
    offerWebUsb: boolean;
}

const DeviceConnect = ({ offerWebUsb }: Props) => {
    const fadeStyles = useSpring({
        config: { ...config.default },
        delay: 1000,
        from: { opacity: 0 },
        to: { opacity: 1 },
    });

    // todo: does bridge tip make sense if we know bridge is already running?

    const items = offerWebUsb
        ? [TROUBLESHOOTING_TIP_USB, TROUBLESHOOTING_TIP_CABLE, TROUBLESHOOTING_TIP_BRIDGE]
        : [
              TROUBLESHOOTING_TIP_BRIDGE,
              TROUBLESHOOTING_TIP_CABLE,
              TROUBLESHOOTING_TIP_USB,
              TROUBLESHOOTING_TIP_DIFFERENT_COMPUTER,
          ];

    // additional udev rules for Linux
    if (isLinux()) {
        if (offerWebUsb) {
            // add it at the end for WebUsb case
            items.push(TROUBLESHOOTING_TIP_UDEV);
        } else {
            // add it at second position for Bridge case
            items.splice(1, 0, TROUBLESHOOTING_TIP_UDEV);
        }
    }

    return (
        <Wrapper style={fadeStyles}>
            <TroubleshootingTips
                label={<Translation id="TR_STILL_DONT_SEE_YOUR_TREZOR" />}
                items={items}
                offerWebUsb={offerWebUsb}
                cta={offerWebUsb ? <WebusbButton icon="SEARCH" /> : undefined}
            />
        </Wrapper>
    );
};

export default DeviceConnect;