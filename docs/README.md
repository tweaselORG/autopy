autopy

# autopy

## Table of contents

### Type Aliases

- [SemverVersionSpecifier](README.md#semverversionspecifier)
- [VenvOptions](README.md#venvoptions)

### Functions

- [downloadPython](README.md#downloadpython)
- [getVenv](README.md#getvenv)
- [removeVenv](README.md#removevenv)

## Type Aliases

### SemverVersionSpecifier

Ƭ **SemverVersionSpecifier**: `string` \| `undefined`

A semver version or range that specifies the desired Python version to download or use for a virtual environment. The
version or range should follow the format defined by [semver](https://www.npmjs.com/package/semver). As
[python-build-standalone](https://github.com/indygreg/python-build-standalone) doesn't offer all Python versions, one
should typically specify a range (usually a tilde or caret range). If not specified, the latest available version is
used.

#### Defined in

[index.ts:22](https://github.com/tweaselORG/autopy/blob/main/src/index.ts#L22)

___

### VenvOptions

Ƭ **VenvOptions**: `Object`

Options for creating or getting a virtual environment with specific requirements.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `checkRequirements?` | `boolean` | Whether to check if the requirements are already satisfied and install them if necessary. Defaults to true. If false, the virtual environment may not have (all) the specified packages installed. |
| `name` | `string` | The name of the virtual environment. |
| `pythonVersion` | [`SemverVersionSpecifier`](README.md#semverversionspecifier) | The Python version to use for the virtual environment. Passed to [downloadPython](README.md#downloadpython). |
| `requirements` | { `name`: `string` ; `version`: `string`  }[] | The list of Python packages and their versions to install in the virtual environment. |

#### Defined in

[index.ts:152](https://github.com/tweaselORG/autopy/blob/main/src/index.ts#L152)

## Functions

### downloadPython

▸ **downloadPython**(`versionRange`): `Promise`<`string`\>

Downloads and extracts a Python installation that satisfies the given version range from
[python-build-standalone](https://github.com/indygreg/python-build-standalone) releases. The installation is cached
in a global directory and reused if possible.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `versionRange` | [`SemverVersionSpecifier`](README.md#semverversionspecifier) | A semver version or range that specifies the desired Python version. If not specified, the latest available version is used. |

#### Returns

`Promise`<`string`\>

The path to the Python installation directory.

#### Defined in

[index.ts:99](https://github.com/tweaselORG/autopy/blob/main/src/index.ts#L99)

___

### getVenv

▸ **getVenv**(`options`): `Promise`<(`file`: `string`, `args?`: `string`[], `options?`: `Options`) => `ExecaChildProcess`<`string`\>\>

Creates or gets a virtual environment with the specified Python version and requirements. Returns a function for
running commands in the virtual environment.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | [`VenvOptions`](README.md#venvoptions) | The options for creating or getting the virtual environment. See [VenvOptions](README.md#venvoptions). |

#### Returns

`Promise`<(`file`: `string`, `args?`: `string`[], `options?`: `Options`) => `ExecaChildProcess`<`string`\>\>

A function that can be used to execute Python commands in the virtual environment, with all necessary
  environment variables set up correctly. The function is a wrapper around
  [`execa`](https://github.com/sindresorhus/execa).

#### Defined in

[index.ts:185](https://github.com/tweaselORG/autopy/blob/main/src/index.ts#L185)

___

### removeVenv

▸ **removeVenv**(`name`): `Promise`<`void`\>

Removes the virtual environment with the specified name.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | The name of the virtual environment to remove. |

#### Returns

`Promise`<`void`\>

#### Defined in

[index.ts:239](https://github.com/tweaselORG/autopy/blob/main/src/index.ts#L239)
