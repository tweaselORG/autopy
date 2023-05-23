import { decompress as decompressZstd } from '@mongodb-js/zstd';
import { satisfies as pep440Satisfies } from '@renovatebot/pep440';
import { createHash } from 'crypto';
import decompress from 'decompress';
import type { Options as ExecaOptions } from 'execa';
import { execa } from 'execa';
import fse from 'fs-extra';
import globalCacheDir from 'global-cache-dir';
import { Octokit } from 'octokit';
import { join } from 'path';
import semverCompare from 'semver/functions/compare.js';
import semverSatifies from 'semver/functions/satisfies.js';
import { version as autopyVersion } from '../package.json';

/**
 * A semver version or range that specifies the desired Python version to download or use for a virtual environment. The
 * version or range should follow the format defined by [semver](https://www.npmjs.com/package/semver). As
 * [python-build-standalone](https://github.com/indygreg/python-build-standalone) doesn't offer all Python versions, one
 * should typically specify a range (usually a tilde or caret range). If not specified, the latest available version is
 * used.
 */
export type SemverVersionSpecifier = string | undefined;

const getPythonDownloadLink = async (versionRange: SemverVersionSpecifier) => {
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
                    if (a.version && b.version) return semverCompare(b.version, a.version);
                    if (a.version) return -1;
                    if (b.version) return 1;
                    return 0;
                })
                .find((a) => a.version && semverSatifies(a.version, version));
            if (asset) {
                const checksumAsset = release.assets.find((a) => a.name === `${asset.name}.sha256`);
                return {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    version: asset.version!,
                    pythonUrl: asset.browser_download_url,
                    checksumUrl: checksumAsset?.browser_download_url,
                };
            }
        }
    }

    throw new Error(`No release for Python ${version} found.`);
};

/**
 * Downloads and extracts a Python installation that satisfies the given version range from
 * [python-build-standalone](https://github.com/indygreg/python-build-standalone) releases. The installation is cached
 * in a global directory and reused if possible.
 *
 * @param versionRange A semver version or range that specifies the desired Python version. If not specified, the latest
 *   available version is used.
 * @returns The path to the Python installation directory.
 */
export const downloadPython = async (versionRange: SemverVersionSpecifier) => {
    const cacheDir = await globalCacheDir('autopy');
    await fse.ensureDir(join(cacheDir, 'python'));

    // Check if we already have a Python installation that satisfies the version range.
    const existingInstallations = await fse.readdir(join(cacheDir, 'python'));
    const matchingExistingVersion = existingInstallations
        .sort((a, b) => semverCompare(b, a))
        .find((v) => !versionRange || semverSatifies(v, versionRange));
    if (matchingExistingVersion) {
        const existingPythonDir = join(cacheDir, 'python', matchingExistingVersion);
        if (await fse.pathExists(join(existingPythonDir, 'bin', 'python3'))) return existingPythonDir;

        await fse.remove(existingPythonDir);
    }

    // Otherwise, download this Python version.
    const { version, pythonUrl, checksumUrl } = await getPythonDownloadLink(versionRange);
    if (!checksumUrl) throw new Error(`No checksum URL for Python ${version} found.`);

    const pythonArchive = await fetch(pythonUrl).then((res) => res.arrayBuffer());
    const expectedHash = await fetch(checksumUrl)
        .then((res) => res.text())
        .then((t) => t.trim());

    const hash = createHash('sha256').update(Buffer.from(pythonArchive)).digest('hex');
    if (hash !== expectedHash) throw new Error(`Checksum mismatch: Expected "${expectedHash}", got "${hash}".`);

    const pythonDir = join(cacheDir, 'python', version);
    await fse.ensureDir(pythonDir);

    const tarOrTarGz = pythonUrl.endsWith('.zst')
        ? await decompressZstd(Buffer.from(pythonArchive))
        : Buffer.from(pythonArchive);
    await decompress(tarOrTarGz, pythonDir, { strip: 1 });

    return pythonDir;
};

// TODO: More thorough check.
const isVenv = (dir: string) => fse.pathExists(join(dir, 'pyvenv.cfg'));

/** Options for creating or getting a virtual environment with specific requirements. */
export type VenvOptions = {
    /** The name of the virtual environment. */
    name: string;
    /** The Python version to use for the virtual environment. Passed to {@link downloadPython}. */
    pythonVersion: SemverVersionSpecifier;
    /** The list of Python packages and their versions to install in the virtual environment. */
    requirements: {
        /** The name of the package to install. */
        name: string;
        /**
         * A [PEP 440 version specifier](https://peps.python.org/pep-0440/#version-specifiers) that defines the version
         * of the package to install.
         */
        version: string;
    }[];

    /**
     * Whether to check if the requirements are already satisfied and install them if necessary. Defaults to true. If
     * false, the virtual environment may not have (all) the specified packages installed.
     */
    checkRequirements?: boolean;
};

/**
 * Creates or gets a virtual environment with the specified Python version and requirements. Returns a function for
 * running commands in the virtual environment.
 *
 * @param options The options for creating or getting the virtual environment. See {@link VenvOptions}.
 *
 * @returns A function that can be used to execute Python commands in the virtual environment, with all necessary
 *   environment variables set up correctly. The function is a wrapper around
 *   [`execa`](https://github.com/sindresorhus/execa).
 */
export const getVenv = async (options: VenvOptions) => {
    const cacheDir = await globalCacheDir('autopy');
    const venvDir = join(cacheDir, 'venv', options.name);

    const pythonDir = await downloadPython(options.pythonVersion);
    const globalPythonBinary =
        process.platform === 'win32' ? join(pythonDir, 'python.exe') : join(pythonDir, 'bin', 'python3');

    if (!(await fse.pathExists(venvDir)) || !(await isVenv(venvDir)))
        await execa(globalPythonBinary, ['-m', 'venv', venvDir]);

    const venvPythonBinary =
        process.platform === 'win32' ? join(venvDir, 'Scripts', 'python.exe') : join(venvDir, 'bin', 'python3');

    if (options.checkRequirements !== false) {
        const installedPackages = await execa(venvPythonBinary, [
            '-m',
            'pip',
            'list',
            '--local',
            '--format',
            'json',
        ]).then((r) => JSON.parse(r.stdout) as { name: string; version: string }[]);
        const missingPackages = options.requirements.filter(
            (r) => !installedPackages.some((p) => p.name === r.name && pep440Satisfies(p.version, r.version))
        );

        if (missingPackages.length > 0)
            await execa(venvPythonBinary, [
                '-m',
                'pip',
                'install',
                ...missingPackages.map((r) => `${r.name}${r.version}`),
            ]);
    }

    const venvBinDir = join(venvDir, process.platform === 'win32' ? 'Scripts' : 'bin');
    return (file: string, args?: string[], options?: ExecaOptions) =>
        execa(file, args, {
            ...options,
            env: {
                PYTHONHOME: undefined,
                VIRTUAL_ENV: venvDir,
                PATH: `${venvBinDir}${process.platform === 'win32' ? ';' : ':'}${process.env['PATH']}`,
                ...options?.env,
            },
        });
};
