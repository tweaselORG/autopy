import { Octokit } from 'octokit';
import semverCompare from 'semver/functions/compare.js';
import semverSatifies from 'semver/functions/satisfies';
import { version as autopyVersion } from '../package.json';

// TODO: Semver version or range according to https://www.npmjs.com/package/semver. As python-build-standalone doesn't offer all
// Python versions, one should typically specify a range (usually a tilde or caret range). If not specified, the latest
// available version is used.
export type VersionSpecifier = string | undefined;

export const getPythonDownloadLink = async (versionRange: VersionSpecifier) => {
    const version = versionRange ?? '>= 0';

    const targetMap = {
        darwin: {
            x64: 'x86_64-apple-darwin',
            arm64: 'aarch64-apple-darwin',
        },
        win32: {
            x64: 'x86_64-pc-windows-msvc-shared',
            ia32: 'i686-pc-windows-msvc-shared',
        },
        linux: {
            x64: 'x86_64-unknown-linux-gnu',
            ia32: 'i686-unknown-linux-gnu',
            arm64: 'aarch64-unknown-linux-gnu',
        },
    };
    const target = targetMap[process.platform as 'win32'][process.arch as 'x64'];
    if (!target) throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`);

    const octokit = new Octokit({
        userAgent: `autopy/${autopyVersion} (https://github.com/tweaselORG/autopy)`,
    });

    const releasesIterator = octokit.paginate.iterator(octokit.rest.repos.listReleases, {
        owner: 'indygreg',
        repo: 'python-build-standalone',
        // eslint-disable-next-line camelcase
        per_page: versionRange === undefined ? 1 : 10,
    });

    for await (const { data: releases } of releasesIterator) {
        for (const release of releases) {
            if (release.draft) continue;

            // "Casual users will likely want to use the `install_only` archive, as most users do not need the build
            // artifacts present in the `full` archive."
            const assetRegex = new RegExp(
                `^cpython-(?<version>\\d+\\.\\d+\\.\\d+)\\+\\d+-${target}-install_only\\.tar\\.(?<ext>gz|zst)$`
            );

            const asset = release.assets
                .map((a) => ({ ...a, version: assetRegex.exec(a.name)?.groups?.['version'] }))
                .sort((a, b) => {
                    if (a.version) return -1;
                    if (b.version) return 1;
                    if (a.version && b.version) return semverCompare(b.version, a.version);
                    return 0;
                })
                .find((a) => a.version && semverSatifies(a.version, version));
            if (asset) {
                const checksumAsset = release.assets.find((a) => a.name === `${asset.name}.sha256`);
                return {
                    url: asset.browser_download_url,
                    checksumUrl: checksumAsset?.browser_download_url,
                };
            }
        }
    }

    throw new Error(`No release for Python ${version} found.`);
};
