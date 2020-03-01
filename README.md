# 📦 PackWatch 👀

> It ain't easy being tiny.

[![codecov](https://codecov.io/gh/mcataford/packwatch/branch/master/graph/badge.svg)](https://codecov.io/gh/mcataford/packwatch)
![packwatch CI](https://github.com/mcataford/packwatch/workflows/packwatch%20CI/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Overview

`packwatch` is inspired by what projects like [`bundlewatch`](https://github.com/bundlewatch/bundlewatch) do for webpack bundle size monitoring and applies the same general idea to monitor your node packages' tarball sizes across time and help avoid incremental bloat. Keeping your applications as trim as possible is important to provide better experiences to users and to avoid wasting system resources, and being cognizant of the footprint of the packages you put out there is paramount.

Using `packwatch`, you can track your package's expected size, packed and unpacked, via a manifest comitted along with your code. You can use it to define an upper limit for your package's size and validate that increases in package footprint are warranted and not accidental.

## Installation

Installing `packwatch` is easy as pie:

```
yarn add packwatch -D
```

or 

```
npm install packwatch --dev
```

While you can install `packwatch` as a global package, it's better to include it as a devDependency in your project.


## Usage

`packwatch` tracks your packages' size via its `.packwatch.json` manifest. To get started, call `packwatch` at the root of your project: a fresh manifest will be generated for you using your current package's size as the initial upper limit for package size.

Once a manifest file exists, calling `packwatch` again will compare its data to the current state of your package. Every time `packwatch` compares your code to the manifest, it will update the last reported package size statistics it contains, but not the limit you have set.

At any time, you can update the limit specified in your manifest by using the `--update-manifest` flag:

```
packwatch --update-manifest
```

Just commit your `.packwatch.json` manifest and you're good to go!
