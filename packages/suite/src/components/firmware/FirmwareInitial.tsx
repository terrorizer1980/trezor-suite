import React, { useEffect } from 'react';
import { Button } from '@trezor/components';
import { ConnectDevicePromptManager, OnboardingButton } from '@onboarding-components';
import { Translation } from '@suite-components';
import { getFwUpdateVersion, getFwVersion } from '@suite-utils/device';
import { useDevice, useFirmware, useActions } from '@suite-hooks';
import {
    ReconnectDevicePrompt,
    InstallButton,
    FirmwareOffer,
    OnboardingStepBox,
} from '@firmware-components';
import * as onboardingActions from '@onboarding-actions/onboardingActions';
import { AcquiredDevice } from '@suite/types/suite';

interface Props {
    cachedDevice: AcquiredDevice;
    setCachedDevice: React.Dispatch<React.SetStateAction<AcquiredDevice>>;
}

const FirmwareInitial = ({ cachedDevice, setCachedDevice }: Props) => {
    const { device: liveDevice } = useDevice();
    const { setStatus, firmwareUpdate, status } = useFirmware();
    const { goToNextStep } = useActions({
        goToNextStep: onboardingActions.goToNextStep,
    });
    useEffect(() => {
        // When user choses to install a new firmware update we will ask him/her to reconnect a device in bootloader mode.
        // This prompt (to reconnect a device in bootloader mode) is shown in modal which is visually layer above the content.
        // We are caching the device in order to preserve the background content (screen with fw update offer) when user
        // disconnects the device and reconnects it in bl mode.
        // (Device in BL mode doesn't provide us all the details and we don't want any flickering o reacting in general while user is just following our instructions)
        if (liveDevice?.connected && liveDevice?.mode !== 'bootloader' && liveDevice.features) {
            // we never store state of the device while it is in bootloader, we want just "normal" mode
            setCachedDevice(liveDevice);
        }
    }, [cachedDevice.id, liveDevice, setCachedDevice]);

    // User is following instructions for disconnecting/reconnecting a device in bootloader mode; We'll use cached version of the device
    const device = status === 'waiting-for-bootloader' ? cachedDevice : liveDevice;
    const expectedModel = device?.features?.major_version || 2;

    let content;

    if (!device?.connected || !device?.features) {
        // Most users won't see this as they should come here with a connected device.
        // This is just for people who want to shoot themselves in the foot and disconnect the device before proceeding with fw update flow
        // Be aware that disconnection after fw installation () is completed is fineand won't be caught by this, because device variable will point to cached device
        return <ConnectDevicePromptManager device={device} />;
    }

    if (device.firmware === 'none') {
        // No firmware installed
        // Device without firmware is already in bootloader mode even if it doesn't report it
        content = {
            heading: <Translation id="TR_INSTALL_FIRMWARE" />,
            description: <Translation id="TR_FIRMWARE_SUBHEADING" />,
            body: cachedDevice.firmwareRelease?.isLatest ? (
                <FirmwareOffer
                    newVersion={getFwUpdateVersion(cachedDevice)}
                    releaseChangelog={cachedDevice.firmwareRelease}
                />
            ) : undefined,
            innerActions: <InstallButton onClick={firmwareUpdate} />,
        };
    } else if (device.mode === 'bootloader') {
        // We can check if device.mode is bootloader only after checking that firmware !== none (condition above)
        // because device without firmware always reports that it is in bootloader mode
        // content = { body: <ReconnectInNormalStep.Body /> };
        return <ConnectDevicePromptManager device={device} />;
    } else if (device.firmware === 'required' || device.firmware === 'outdated') {
        // Fw update needed/available
        content = {
            heading: <Translation id="TR_INSTALL_FIRMWARE" />,
            description: (
                <Translation
                    id={
                        device.firmware === 'required'
                            ? 'TR_FIRMWARE_UPDATE_REQUIRED_EXPLAINED'
                            : 'TR_YOU_MAY_EITHER_UPDATE'
                    }
                />
            ),
            body: (
                <FirmwareOffer
                    currentVersion={getFwVersion(device)}
                    newVersion={getFwUpdateVersion(device)}
                    releaseChangelog={device?.firmwareRelease}
                />
            ),
            innerActions: (
                <Button
                    onClick={() => setStatus('waiting-for-bootloader')}
                    data-test="@firmware/get-ready-button"
                >
                    <Translation id="TR_INSTALL" />
                </Button>
            ),
            outerActions:
                device.firmware === 'outdated' ? (
                    // Fw update is not mandatory, show skip button
                    <OnboardingButton.Skip
                        onClick={() => goToNextStep()}
                        data-test="@firmware/skip-button"
                    >
                        <Translation id="TR_SKIP_UPDATE" />
                    </OnboardingButton.Skip>
                ) : undefined,
        };
    }

    // device.firmware === 'valid' is handled in in NoNewFirmware

    if (content) {
        return (
            <>
                {/* Modal above a fw update offer. Instructs user to reconnect the device in bootloader */}
                {status === 'waiting-for-bootloader' && (
                    <ReconnectDevicePrompt
                        deviceVersion={expectedModel}
                        requestedMode="bootloader"
                    />
                )}

                <OnboardingStepBox
                    image="FIRMWARE"
                    heading={content.heading}
                    description={content.description}
                    innerActions={content.innerActions}
                    outerActions={content.outerActions}
                    confirmOnDevice={
                        status === 'waiting-for-confirmation'
                            ? device?.features?.major_version
                            : undefined
                    }
                >
                    {content.body}
                </OnboardingStepBox>
            </>
        );
    }
    return null;
};

export { FirmwareInitial };