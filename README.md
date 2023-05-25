# autopy

> Library for depending on Python packages from JavaScript that will automatically manage a venv and download Python and pip dependencies.

Autopy is a library that simplifies the integration of Python libraries in JavaScript projects. It can automatically download a Python distribution with a given version, create a virtual environment, and install the desired dependencies into that. It then gives you a function that you can use to run commands in the virtual environment, with all necessary environment variables set up correctly.

Autopy is designed for scenarios where you need to depend on Python tools and libraries that are not available or easy to use in JavaScript. With autopy, you can leverage the power of Python without leaving your JavaScript ecosystem.

Autopy works on Windows (32-bit and 64-bit), Linux (x86_64, i686, and aarch64), and macOS (x86_64 and arm64). It uses [python-build-standalone](https://github.com/indygreg/python-build-standalone) to download pre-built Python distributions for these platforms and architectures. For that, it calls the GitHub API. Be aware of the privacy implications.

## Installation

You can install autopy using yarn or npm:

```sh
yarn add autopy
# or `npm i autopy`
```

## API reference

A full API reference can be found in the [`docs` folder](/docs/README.md).

## Example usage

Let's say you want to use the powerful [mitmproxy](https://mitmproxy.org/) for intercepting and modifying HTTP and HTTPS traffic in your JavaScript project. Here's how you can do that with autopy:

```ts
import { getVenv } from 'autopy';

(async () => {
    // Create a virtual environment with mitmproxy installed.
    const python = await getVenv({
        name: 'mitmproxy',
        pythonVersion: '~3.11', // Use any Python 3.11.x version.
        requirements: [{ name: 'mitmproxy', version: '>=9.0' }], // Use any mitmproxy version above 9.0.
    });

    // Run mitmdump to start a proxy server on port 8081.
    const proc = python('mitmdump', ['-p', '8081']);
    proc.stdout?.pipe(process.stdout);

    setTimeout(() => proc.kill(), 1000);
})();

// Output:
// [14:46:27.973] HTTP(S) proxy listening at *:8081.
```

## License

This code is licensed under the MIT license, see the [`LICENSE`](LICENSE) file for details.

Issues and pull requests are welcome! Please be aware that by contributing, you agree for your work to be licensed under an MIT license.
