/* eslint-disable camelcase */
import { filterSafeListByFirmware, filterSafeListByBootloader } from './utils/releases';
import { fetchFirmware } from './utils/fetch';
import { getScore } from './utils/score';
import * as versionUtils from './utils/version';
import { parseFeatures, parseReleases, Release, Features } from './utils/parse';

type ParsedFeatures = ReturnType<typeof parseFeatures>;

/**
 * Returns firmware binary after necessary modifications. Should be ok to install.
 */
export const modifyFirmware = ({ fw, features }: { fw: ArrayBuffer; features: ParsedFeatures }) => {
    // ---------------------
    // Model T modifications
    // ---------------------
    // there are currently none.
    if (features.major_version === 2) return fw;

    // -----------------------
    // Model One modifications
    // -----------------------

    // any version installed on bootloader 1.8.0 must be sliced of the first 256 bytes (containing old firmware header)
    // unluckily, we don't know the actual bootloader of connected device, but we can assume it is 1.8.0 in case
    // getInfo() returns firmware with version 1.8.1 or greater as it has bootloader version 1.8.0 (see releases.json)
    // this should be temporary until special bootloader updating firmware are ready
    if (
        versionUtils.isNewerOrEqual(
            [features.major_version, features.minor_version, features.patch_version],
            [1, 8, 0]
        )
    ) {
        const fwView = new Uint8Array(fw);
        // this condition was added in order to upload firmware process being equivalent as in trezorlib python code
        if (
            String.fromCharCode(...Array.from(fwView.slice(0, 4))) === 'TRZR' &&
            String.fromCharCode(...Array.from(fwView.slice(256, 260))) === 'TRZF'
        ) {
            return fw.slice(256);
        }
    }
    return fw;
};

const getChangelog = (releases: Release[], features: ParsedFeatures) => {
    // releases are already filtered, so they can be considered "safe".
    // so lets build changelog! It should include only those firmwares, that are
    // newer than currently installed firmware.

    if (features.bootloader_mode) {
        // the problem with bootloader is that we see only bootloader and not firmware version
        // and multiple releases may share same bootloader version. we really can not tell that
        // the versions that are installable are newer. so...
        if (features.firmware_present && features.major_version === 1) {
            // return null signaling that we don't really know, but only if some firmware
            // is already installed!
            return null;
        }
        if (features.firmware_present && features.major_version === 2) {
            // little different situation is with model 2, where in bootloader (and with some fw installed)
            // we actually know the firmware version
            return releases.filter(r =>
                versionUtils.isNewer(r.version, [
                    features.fw_major,
                    features.fw_minor,
                    features.fw_patch,
                ])
            );
        }
        // for fresh devices, we can assume that all releases are actually "new"
        return releases;
    }

    // otherwise we are in firmware mode and because each release in releases list has
    // version higher than the previous one, we can filter out the version that is already
    // installed and show only what's new!
    return releases.filter(r =>
        versionUtils.isNewer(r.version, [
            features.major_version,
            features.minor_version,
            features.patch_version,
        ])
    );
};

const isNewer = (release: Release, features: ParsedFeatures) => {
    if (features.major_version === 1 && features.bootloader_mode) {
        return null;
    }
    return versionUtils.isNewer(release.version, [
        features.major_version,
        features.minor_version,
        features.patch_version,
    ]);
};

const isRequired = (changelog: ReturnType<typeof getChangelog>) => {
    if (!changelog || !changelog.length) return null;
    return changelog.some(item => item.required);
};

const isEqual = (release: Release, latest: Release) =>
    versionUtils.isEqual(release.version, latest.version);

const getReleasesByScore = (releases: Release[], deviceId: string | null) => {
    if (!deviceId) {
        return releases;
    }

    const score = getScore(deviceId);
    return releases.filter(item => !item.rollout || item.rollout >= score);
};

const filterByFirmware = (releases: Release[], features: ParsedFeatures) => {
    const { major_version, fw_major, fw_minor, fw_patch } = features;

    if (major_version === 2 && fw_major !== null && fw_minor !== null && fw_patch !== null) {
        // in bootloader, model T knows its firmware, so we still may filter "by firmware".
        return filterSafeListByFirmware(releases, [fw_major, fw_minor, fw_patch]);
    }
    // model one does not know its firmware, we need to filter by bootloader. this has the consequence
    // that we do not know if the version we find in the end is newer than the actual installed version
    return releases;
};

const getSafeReleases = (releases: Release[], features: ParsedFeatures) => {
    const { bootloader_mode, major_version, minor_version, patch_version } = features;

    if (bootloader_mode) {
        const filteredByFirmware = filterByFirmware(releases, features);

        return filterSafeListByBootloader(filteredByFirmware, [
            major_version,
            minor_version,
            patch_version,
        ]);
    }
    // in other cases (not in bootloader) we may filter by firmware
    return filterSafeListByFirmware(releases, [major_version, minor_version, patch_version]);
};
interface GetInfoProps {
    features: Features;
    releases: Release[];
}

/**
 * Get info about available firmware update
 * @param features
 * @param releases
 */
export const getInfo = ({ features, releases }: GetInfoProps) => {
    const parsedFeatures = parseFeatures(features);
    const parsedReleases = parseReleases(releases);

    const rollouts = getReleasesByScore(parsedReleases, parsedFeatures.device_id);
    if (!rollouts.length) {
        // no new firmware
        return null;
    }
    const latest = rollouts[0];
    const changelog = getChangelog(rollouts, parsedFeatures);

    const latestSafe = getSafeReleases(rollouts, parsedFeatures)[0];

    return {
        changelog,
        release: latest,
        latestSafe,
        isSafe: !!latestSafe && isEqual(latestSafe, latest),
        isRequired: isRequired(changelog),
        isNewer: isNewer(latest, parsedFeatures),
    };
};

interface GetBinaryProps extends GetInfoProps {
    baseUrl: string;
    btcOnly?: boolean;
    version?: Release['version'];
    intermediary?: boolean;
}

/**
 * Accepts version of firmware that is to be installed.
 * Also accepts features and releases list in order to validate that the provided version
 * is safe.
 * Ignores rollout (score)
 */
export const getBinary = async ({
    features,
    releases,
    baseUrl,
    version,
    btcOnly,
    intermediary = false,
}: GetBinaryProps) => {
    const parsedFeatures = parseFeatures(features);
    const infoByBootloader = getInfo({ features, releases });

    let releaseByFirmware;

    if (!intermediary) {
        // we get info here again, but only as a sanity check.
        releaseByFirmware = releases.find(r => versionUtils.isEqual(r.version, version!));

        if (!infoByBootloader || !releaseByFirmware) {
            throw new Error('no firmware found for this device');
        }
    } else {
        const fw = await fetchFirmware(`${baseUrl}/firmware/1/trezor-inter-1.10.0.bin`);
        return { ...infoByBootloader, binary: modifyFirmware({ fw, features: parsedFeatures }) };
    }

    if (btcOnly && !releaseByFirmware.url_bitcoinonly) {
        throw new Error(`firmware version ${version} does not exist in btc only variant`);
    }

    // it is better to be defensive and not allow user update rather than let him wipe his seed
    // in case of improper update
    if (!versionUtils.isEqual(releaseByFirmware.version, infoByBootloader.release.version)) {
        throw new Error(
            'version provided as param does not match firmware version found by features in bootloader'
        );
    }
    const fw = await fetchFirmware(
        `${baseUrl}/${btcOnly ? releaseByFirmware.url_bitcoinonly : releaseByFirmware.url}`
    );
    return {
        ...infoByBootloader,
        binary: modifyFirmware({ fw, features: parsedFeatures }),
    };
};

export type FirmwareRelease = ReturnType<typeof getInfo>;
export type FirmwareBinary = ReturnType<typeof getBinary>;
